locals {
  host = var.domain != "" ? var.domain : "${replace(aws_instance.demo.public_ip, ".", "-")}.sslip.io"
}

output "url" {
  description = "Open this once the instance has finished booting (about 5 minutes)."
  value       = "https://${local.host}"
}

output "mailpit_url" {
  description = "Inbox that receives verification and password-reset codes."
  value       = "https://${local.host}/mailpit/"
}

output "mailpit_login" {
  value = "demo / ${nonsensitive(random_password.mailpit.result)}"
}

output "instance_id" {
  value = aws_instance.demo.id
}

output "boot_log_command" {
  description = "Shows what the instance has done so far (readable a minute or two after boot)."
  value       = "aws ec2 get-console-output --region ${var.region} --instance-id ${aws_instance.demo.id} --latest --output text"
}
