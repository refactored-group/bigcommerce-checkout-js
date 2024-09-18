FROM node:20-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache \
      python3 \
      make \
      g++ \
      git

ENTRYPOINT ["npm"]
