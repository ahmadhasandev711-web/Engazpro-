FROM php:8.2-cli

# Install system dependencies, networking utilities, and PHP extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    unzip \
    libzip-dev \
    libonig-dev \
    libxml2-dev \
    default-mysql-client \
    iproute2 \
    dnsutils \
    procps \
    && docker-php-ext-install pdo_mysql bcmath mbstring pcntl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/backend

EXPOSE 28180
