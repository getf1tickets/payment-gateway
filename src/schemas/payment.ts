import { enumToArray, PaymentMethodType } from '@getf1tickets/sdk';

export const paymentCreationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['orderId', 'method'],
  properties: {
    orderId: { type: 'string' },
    method: {
      type: 'string',
      enum: enumToArray(PaymentMethodType, true),
    },
  },
};

export const paymentResponseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    url: { type: 'string' },
  },
};
