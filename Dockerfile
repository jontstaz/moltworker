FROM docker.io/cloudflare/sandbox:0.7.0

# Install Node.js 22 (required by openclaw), Python 3, and rsync (for R2 backup sync)
# The base image has Node 20, we need to replace it with Node 22
# Using direct binary download for reliability
ENV NODE_VERSION=22.13.1
RUN apt-get update && apt-get install -y xz-utils ca-certificates rsync python3 python3-pip \
    && curl -fsSLk https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz -o /tmp/node.tar.xz \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm /tmp/node.tar.xz \
    && node --version \
    && npm --version \
    && python3 --version \
    && pip3 --version

# Add python -> python3 symlink for convenience
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Install pnpm globally
RUN npm install -g pnpm

# Install OpenClaw
# Pin to specific version for reproducible builds
RUN npm install -g openclaw@2026.2.2 \
    && openclaw --version

# Install ClawHub CLI for skill management
RUN npm install -g clawhub \
    && clawhub --cli-version

# Create openclaw directories
# Templates are stored in /root/.openclaw-templates for initialization
RUN mkdir -p /root/.openclaw \
    && mkdir -p /root/.openclaw-templates \
    && mkdir -p /root/clawd \
    && mkdir -p /root/clawd/skills

# Copy startup script
# Build cache bust: 2026-02-03-exclude-cdp-from-cf-access
COPY start-moltbot.sh /usr/local/bin/start-moltbot.sh
RUN chmod +x /usr/local/bin/start-moltbot.sh

# Copy default configuration template
COPY moltbot.json.template /root/.openclaw-templates/moltbot.json.template

# Copy custom skills to both locations:
# - /root/clawd/skills/ - active workspace skills
# - /usr/local/share/openclaw/skills/ - bundled skills backup for restore
COPY skills/ /root/clawd/skills/
RUN mkdir -p /usr/local/share/openclaw/skills && cp -a /root/clawd/skills/. /usr/local/share/openclaw/skills/

# Set working directory
WORKDIR /root/clawd

# Expose the gateway port
EXPOSE 18789
