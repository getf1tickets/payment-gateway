import {
  Order,
  OrderProduct,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentMethodType,
  PaymentStatus,
  Product,
  User,
  UUID,
} from '@getf1tickets/sdk';
import { FastifyPluginAsync } from 'fastify';
import { paymentCreationSchema, paymentResponseSchema } from '@/schemas/payment';
import { PayPalPayment } from '../plugins/paypal';

const root: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.route<{
    Body: {
      orderId: UUID,
      method: string,
    }
  }>({
    method: 'POST',
    url: '/',
    preHandler: [
      fastify.authentication.authorize(),
      fastify.middlewares.useUser({
        useToken: true,
        includeAddresses: true,
      }),
    ],
    schema: {
      body: paymentCreationSchema,
      response: {
        200: paymentResponseSchema,
      },
    },
    handler: async (request) => {
      const order = await fastify.to500<Order>(Order.findOne({
        where: {
          id: request.body.orderId,
        },
        include: [
          {
            model: User,
            as: 'user',
            where: {
              id: request.user.id,
            },
          },
          {
            model: OrderProduct,
            as: 'products',
            include: [
              {
                model: Product,
                as: 'product',
              },
            ],
          },
          {
            model: Payment,
            as: 'payment',
          },
        ],
      }));

      if (order.status !== OrderStatus.CREATED) {
        throw fastify.httpErrors.notFound();
      }

      if (order.payment) {
        throw fastify.httpErrors.conflict();
      }

      // create paypal payment
      const pPayment = await fastify.to500<PayPalPayment>(fastify.paypal.createPayment(order));

      const payment = await fastify.to500<Payment>(order.createPayment({
        amount: order.total,
        status: PaymentStatus.CREATED,
      }));

      await fastify.to500<PaymentMethod>(payment.createMethod({
        transactionId: pPayment.id,
        type: PaymentMethodType.PAYPAL,
        status: pPayment.status,
      }));

      return {
        id: payment.id,
        url: pPayment.links?.find((link) => link.rel === 'approve').href,
      };
    },
  });
};

export default root;
