variable "region" {
  type    = string
  default = "us-east-1"
}

variable "name" {
  description = "Prefix for resource names."
  type        = string
  default     = "minigames-demo"
}

variable "instance_type" {
  description = "Images are built on the instance; two vCPUs keep that to a few minutes."
  type        = string
  default     = "t3.medium"
}

variable "git_repo_url" {
  type    = string
  default = "https://github.com/systemkiller03/minigames-creative-extension.git"
}

variable "git_ref" {
  description = "Branch or tag to deploy. It must contain both api/ and web/."
  type        = string
  default     = "main"
}

variable "max_lifetime_minutes" {
  description = "Safety net: the instance powers off and terminates itself this long after boot."
  type        = number
  default     = 30
}

variable "domain" {
  description = "Optional DNS name for the site. Empty uses <ip>.sslip.io, which needs no setup."
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route 53 zone that contains `domain`. Required when `domain` is set."
  type        = string
  default     = ""
}

variable "allowed_cidrs" {
  description = "Who may reach HTTPS. Port 80 stays open for certificate issuance. Use your own IP for private checks."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "upstream_base_url" {
  type    = string
  default = "https://faxb76kxra.execute-api.eu-central-1.amazonaws.com"
}
