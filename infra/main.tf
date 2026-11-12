# A throwaway demo host. Nothing here outlives `terraform destroy`: it creates its own network,
# keeps no data outside the instance's disk, and the instance terminates itself on shutdown.

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ssm_parameter" "ubuntu_ami" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

resource "random_password" "mailpit" {
  length  = 20
  special = false
}

# ---- network ----------------------------------------------------------------------------

resource "aws_vpc" "demo" {
  cidr_block           = "10.42.0.0/24"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = var.name }
}

resource "aws_internet_gateway" "demo" {
  vpc_id = aws_vpc.demo.id
  tags   = { Name = var.name }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.demo.id
  cidr_block              = "10.42.0.0/25"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  tags                    = { Name = var.name }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.demo.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.demo.id
  }
  tags = { Name = var.name }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "web" {
  name        = var.name
  description = "Demo site: HTTP and HTTPS only"
  vpc_id      = aws_vpc.demo.id

  ingress {
    description = "HTTP: certificate issuance and redirect, so it stays open to everyone"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidrs
  }
  ingress {
    description = "HTTP/3"
    from_port   = 443
    to_port     = 443
    protocol    = "udp"
    cidr_blocks = var.allowed_cidrs
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = { Name = var.name }
}

# ---- access (no SSH key, no open SSH port) ----------------------------------------------

resource "aws_iam_role" "instance" {
  name = var.name
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "instance" {
  name = var.name
  role = aws_iam_role.instance.name
}

# ---- the host ---------------------------------------------------------------------------

resource "aws_instance" "demo" {
  ami                                  = data.aws_ssm_parameter.ubuntu_ami.value
  instance_type                        = var.instance_type
  subnet_id                            = aws_subnet.public.id
  vpc_security_group_ids               = [aws_security_group.web.id]
  iam_instance_profile                 = aws_iam_instance_profile.instance.name
  instance_initiated_shutdown_behavior = "terminate"

  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 1 # the host can read metadata; containers (one hop further) cannot
  }

  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true
  }

  user_data_replace_on_change = true
  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    repo              = var.git_repo_url
    ref               = var.git_ref
    domain            = var.domain
    lifetime          = var.max_lifetime_minutes
    upstream_base_url = var.upstream_base_url
    mailpit_password  = random_password.mailpit.result
  })

  tags = { Name = var.name }
}

resource "aws_route53_record" "site" {
  count   = var.domain == "" ? 0 : 1
  zone_id = var.hosted_zone_id
  name    = var.domain
  type    = "A"
  ttl     = 30
  records = [aws_instance.demo.public_ip]
}
