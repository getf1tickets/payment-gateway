import {
  Order, OrderStatus, Payment, PaymentMethod, PaymentStatus,
} from '@getf1tickets/sdk';
import { FastifyPluginAsync } from 'fastify';

const root: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.route<{
    Querystring: {
      token: string,
      PayerID: string,
    }
  }>({
    method: 'GET',
    url: '/valid',
    handler: async (request, reply) => {
      if (!request.query.token) {
        throw fastify.httpErrors.badRequest();
      }

      const order = await fastify.to500<Order>(Order.findOne({
        include: [
          {
            model: Payment,
            as: 'payment',
            required: true,
            include: [
              {
                model: PaymentMethod,
                as: 'method',
                required: true,
                where: {
                  transactionId: request.query.token,
                },
              },
            ],
          },
        ],
      }));

      if (!order) {
        throw fastify.httpErrors.badRequest();
      }

      if (order.status !== OrderStatus.WAITING_PAYMENT) {
        throw fastify.httpErrors.conflict();
      }

      const pCapture = await fastify.to500(
        fastify.paypal.capturePayment(order.payment.method.transactionId),
      );

      await fastify.to500(order.payment.method.update({
        status: pCapture.status,
      }));

      await fastify.to500(order.payment.update({
        status: PaymentStatus.SUCCESS,
      }));

      await fastify.to500(order.update({
        status: OrderStatus.COMPLETED,
      }));

      reply.redirect(302, `${process.env.WWW_PAYMENT_SUCCESS_REDIRECT_URL}?orderId=${order.id}`);
    },
  });

  fastify.route<{
    Querystring: {
      token: string,
    }
  }>({
    method: 'GET',
    url: '/cancel',
    handler: async (request, reply) => {
      if (!request.query.token) {
        throw fastify.httpErrors.badRequest();
      }

      const order = await fastify.to500<Order>(Order.findOne({
        include: [
          {
            model: Payment,
            as: 'payment',
            required: true,
            include: [
              {
                model: PaymentMethod,
                as: 'method',
                required: true,
                where: {
                  transactionId: request.query.token,
                },
              },
            ],
          },
        ],
      }));

      if (!order) {
        throw fastify.httpErrors.badRequest();
      }

      if (order.status !== OrderStatus.WAITING_PAYMENT) {
        throw fastify.httpErrors.conflict();
      }

      await fastify.to500(order.payment.method.update({
        status: 'CANCELED',
      }));

      await fastify.to500(order.payment.update({
        status: PaymentStatus.CANCELLED,
      }));

      await fastify.to500(order.update({
        status: OrderStatus.CANCELLED,
      }));

      reply.redirect(302, `${process.env.WWW_PAYMENT_CANCEL_REDIRECT_URL}`);
    },
  });
};

export default root;
