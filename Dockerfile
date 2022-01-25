# Build stage
FROM node:16-alpine AS build
WORKDIR /usr/src/app

COPY .npmrc .npmrc
RUN cat .npmrc
COPY package*.json .
RUN npm install

COPY . .
RUN npm run build

# Application stage
FROM node:16-alpine

LABEL MAINTAINER="iverly <contact@iverly.net>"
LABEL APP="f1tickets-payment-gateway"

ENV DATABASE_URL=""
ENV AUTH_SERVER_URL=""
ENV AUTH_SERVER_PATH_TOKEN=""
ENV AUTH_SERVER_PATH_AUTHORIZE=""
ENV WWW_PAYMENT_SUCCESS_REDIRECT_URL=""
ENV WWW_PAYMENT_CANCEL_REDIRECT_URL=""
ENV PAYPAL_CLIENT_ID=""
ENV PAYPAL_CLIENT_SECRET=""
ENV PAYPAL_CALLBACK_VALID_URL=""
ENV PAYPAL_CALLBACK_CANCEL_URL=""
ENV CLOUDAMQP_URL=""
ENV AMQP_EXCHANGE_NAME=""

WORKDIR /usr/app

COPY .npmrc .npmrc
RUN cat .npmrc
COPY package*.json .
COPY --from=build /usr/src/app/node_modules node_modules
COPY --from=build /usr/src/app/dist dist

EXPOSE 3000
CMD ["npm", "start"]
