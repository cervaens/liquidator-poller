
# Liquidator poller
## Description

This application's goal is to identify liquidation opportunities among multiple DeFi protocols and perform a call to a liquidator contract when there is such an opportunity.
Even though the application is working, it's not prod ready as the testing part is not fully complete.

## Dependencies
This applications uses nestjs, it depends on an mongoDB instance and rabbitMQ.

## Installation

```bash
$ yarn install
```

## Running RabbitMQ

```bash
$ docker run --rm -it --hostname my-rabbit -p 15672:15672 -p 5672:5672 rabbitmq:3-management
```

## Running the app

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Test

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).
