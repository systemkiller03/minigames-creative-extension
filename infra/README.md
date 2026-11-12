# Demo infrastructure

A throwaway single-host deployment on AWS, built to be created just before a demo and
destroyed right after. Nothing outlives `terraform destroy`: it creates its own network (the
account has no default VPC), keeps no data outside the instance's disk, and uses no SSH key.

What it creates (11 resources): VPC, internet gateway, one public subnet and route table, a
security group (80 and 443 only), an IAM role and instance profile for SSM, one EC2 instance, and
a generated inbox password. With `domain` set it also creates one Route 53 record.

On boot the instance installs Docker, clones the repo at `git_ref`, generates random secrets,
and runs `deploy/docker-compose.yml`: Caddy (serves the frontend, proxies `/api`, gets a
Let's Encrypt certificate), the API, Postgres, Redis and Mailpit. The first boot builds the images,
so allow about 5 minutes.

## Use

    cd infra
    terraform init
    terraform apply            # prints url, mailpit_url and mailpit_login
    terraform destroy          # removes everything

Open `url` once the boot log says `DEMO READY` (`terraform output boot_log_command`).
Verification and password-reset codes arrive in the Mailpit inbox at `mailpit_url` (user `demo`).
After destroying, `aws ec2 describe-instances --region us-east-1 --filters Name=tag:Project,Values=minigames`
should list only terminated instances.

## Settings (`variables.tf`)

- `git_ref`: branch or tag to deploy; it must contain both `api/` and `web/`.
- `max_lifetime_minutes` (default 30): the instance powers off and terminates itself this long
  after boot, so a forgotten demo cannot keep running. Includes the build time.
- `instance_type` (default `t3.medium`): images are built on the instance, so two vCPUs help.
- `allowed_cidrs`: who can reach HTTPS (default everyone). Port 80 stays open for certificates.
- `domain` and `hosted_zone_id`: optional own hostname. Without them the site is served from
  `<ip-with-dashes>.sslip.io`, which needs no DNS setup.

## Limits

- Google sign-in needs a hostname that never changes, because Google only accepts redirect URIs
  registered in advance. Before the demo, own a domain, set `domain` and `hosted_zone_id`, and add
  `https://<domain>/api/auth/google/callback` to the OAuth client in Google Cloud once (it is also
  printed as the `google_redirect_uri` output). Then pass the credentials on each apply:
  `TF_VAR_google_client_id=... TF_VAR_google_client_secret=... terraform apply`. Without them,
  Google sign-in stays off and email sign-up works through Mailpit. With the `sslip.io` fallback the
  address changes on every deploy, so Google sign-in cannot work there.
- The Google secret is written into the instance's user data and the local Terraform state, so
  treat `terraform.tfstate` as secret and use a client dedicated to the demo.
- Data lives on the instance and is lost with it. State is local (`terraform.tfstate`, ignored by
  git); keep it until you have destroyed.
- The site address uses a public certificate authority. `sslip.io` certificates can occasionally
  hit shared rate limits; a custom `domain` avoids that.
