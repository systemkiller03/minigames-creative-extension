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
  description = "Images are built on the instance, so it needs RAM and two vCPUs. m7i-flex.large is free-tier eligible."
  type        = string
  default     = "m7i-flex.large"
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
  default     = 60
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

variable "duckdns_subdomain" {
  description = "Free alternative to `domain`: a DuckDNS name (without .duckdns.org) that the instance points at itself on boot."
  type        = string
  default     = ""

  validation {
    condition     = var.duckdns_subdomain == "" || var.domain == ""
    error_message = "Use either domain or duckdns_subdomain, not both."
  }
}

variable "duckdns_token" {
  description = "DuckDNS account token. Pass it as TF_VAR_duckdns_token. Required with duckdns_subdomain."
  type        = string
  default     = ""
  sensitive   = true

  validation {
    condition     = (var.duckdns_subdomain == "") == (var.duckdns_token == "")
    error_message = "Set duckdns_subdomain and duckdns_token together, or neither."
  }
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

variable "google_client_id" {
  description = "Google OAuth client ID. Leave empty to turn Google sign-in off."
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret. Pass it as TF_VAR_google_client_secret so it never lands in a file."
  type        = string
  default     = ""
  sensitive   = true

  validation {
    condition     = (var.google_client_id == "") == (var.google_client_secret == "")
    error_message = "Set google_client_id and google_client_secret together, or neither."
  }
}
