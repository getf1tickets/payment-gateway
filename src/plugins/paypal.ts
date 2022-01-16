import fp from 'fastify-plugin';
import * as paypal from '@paypal/checkout-server-sdk';
import { Order, OrderProduct, UUID } from '@getf1tickets/sdk';

export interface PayPalGateway {
  createPayment: (order: Order) => Promise<PayPalPayment>;
  capturePayment: (transactionId: string) => Promise<PayPalCapture>;
}

export interface PayPalPaymentUrl {
  href: string;
  rel: string;
  method: string;
}

export interface PayPalPayment {
  id: string;
  status: string;
  links: PayPalPaymentUrl[];
}

export interface PayPalCapture {
  id: string;
  status: string;
}

export default fp(async (fastify) => {
  const environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET,
  );
  const client = new paypal.core.PayPalHttpClient(environment);

  const buildPaymentBody = (orderId: UUID, products: OrderProduct[], total: number) => ({
    intent: 'CAPTURE',
    application_context: {
      return_url: process.env.PAYPAL_CALLBACK_VALID_URL,
      cancel_url: process.env.PAYPAL_CALLBACK_CANCEL_URL,
      brand_name: 'F1 Tickets',
      locale: 'en-US',
      landing_page: 'NO_PREFERENCE',
      user_action: 'CONTINUE',
      shipping_preference: 'NO_SHIPPING',
    },
    purchase_units: [
      {
        reference_id: orderId,
        amount: {
          currency_code: 'USD',
          value: total,
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: total,
            },
          },
        },
        items: products.map(({ product, quantity }) => ({
          name: product.name,
          quantity,
          unit_amount: {
            currency_code: 'USD',
            value: product.price,
          },
          category: 'DIGITAL_GOODS',
        })),
      },
    ],
  });

  const createPayment = async (order: Order): Promise<PayPalPayment> => {
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody(buildPaymentBody(order.id, order.products, order.total));
    const { statusCode, result } = await client.execute(request);

    if (statusCode !== 201) {
      fastify.log.error(result);
      throw fastify.httpErrors.internalServerError();
    }

    return result;
  };

  const capturePayment = async (transactionId: string): Promise<PayPalCapture> => {
    const request = new paypal.orders.OrdersCaptureRequest(transactionId);
    request.requestBody({});
    const { statusCode, result } = await client.execute(request);

    if (statusCode !== 201) {
      fastify.log.error(result);
      throw fastify.httpErrors.internalServerError();
    }

    return result;
  };

  fastify.decorate('paypal', {
    createPayment,
    capturePayment,
  });
}, {
  name: 'paypal-gateway',
});
