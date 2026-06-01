
#!/usr/bin/env bash

# Define the secret key used for signing the token
SECRET="your-super-secret-jwt-token-with-at-least-32-characters-long"

# 1. Base64 URL Encoding Function
# Converts standard Base64 to URL-safe Base64 by swapping characters and stripping padding
b64_url_encode() {
    local input
    input=$(cat)
    echo -n "$input" | openssl base64 -e -A | tr '+/' '-_' | tr -d '='
}

# 2. Define Header (Standard HS256 JWT header)
HEADER='{"alg":"HS256","typ":"JWT"}'

# 3. Define Payload (Includes standard 'iat' and 'exp' claims)
CURRENT_TIME=$(date +%s)
EXPIRATION_TIME=$((CURRENT_TIME + 3600)) # Token expires in 1 hour (3600 seconds)

PAYLOAD=$(cat <<EOF
{

  "role": 'anon',
  "iss": 'supabase',
  "iat": $CURRENT_TIME,
  "exp": $EXPIRATION_TIME
}
EOF
)

# 4. Encode Header and Payload
ENCODED_HEADER=$(echo -n "$HEADER" | b64_url_encode)
ENCODED_PAYLOAD=$(echo -n "$PAYLOAD" | b64_url_encode)

# 5. Sign the encoded parts using HMAC-SHA256
SIGNATURE=$(echo -n "${ENCODED_HEADER}.${ENCODED_PAYLOAD}" \
    | openssl dgst -sha256 -hmac "$SECRET" -binary \
    | b64_url_encode)
# 6. Assemble and output the final JWT token
JWT_TOKEN="${ENCODED_HEADER}.${ENCODED_PAYLOAD}.${SIGNATURE}"
echo "$JWT_TOKEN"
