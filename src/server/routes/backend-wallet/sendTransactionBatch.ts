import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { Address, Hex } from "thirdweb";
import { maybeBigInt } from "../../../utils/primitiveTypes";
import { insertTransaction } from "../../../utils/transaction/insertTransaction";
import { standardResponseSchema } from "../../schemas/sharedApiSchemas";
import { txOverridesWithValueSchema } from "../../schemas/txOverrides";
import {
  walletChainParamSchema,
  walletHeaderSchema,
} from "../../schemas/wallet";
import { getChainIdFromChain } from "../../utils/chain";

const requestBodySchema = Type.Array(
  Type.Object({
    toAddress: Type.Optional(
      Type.String({
        examples: ["0x..."],
      }),
    ),
    data: Type.String({
      examples: ["0x..."],
    }),
    value: Type.String({
      examples: ["10000000"],
    }),
    ...txOverridesWithValueSchema.properties,
  }),
);

const responseBodySchema = Type.Object({
  result: Type.Object({
    queueIds: Type.Array(Type.String()),
  }),
});

export async function sendTransactionBatch(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof walletChainParamSchema>;
    Body: Static<typeof requestBodySchema>;
    Reply: Static<typeof responseBodySchema>;
  }>({
    method: "POST",
    url: "/backend-wallet/:chain/send-transaction-batch",
    schema: {
      summary: "Send a batch of raw transactions",
      description:
        "Send a batch of raw transactions with transaction parameters",
      tags: ["Backend Wallet"],
      operationId: "sendTransactionBatch",
      params: walletChainParamSchema,
      body: requestBodySchema,
      headers: walletHeaderSchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseBodySchema,
      },
    },
    handler: async (request, reply) => {
      const { chain } = request.params;
      const { "x-backend-wallet-address": fromAddress } =
        request.headers as Static<typeof walletHeaderSchema>;
      const chainId = await getChainIdFromChain(chain);

      const transactionRequests = request.body;

      const queueIds: string[] = [];
      for (const transactionRequest of transactionRequests) {
        const { toAddress, data, value, txOverrides } = transactionRequest;

        const queueId = await insertTransaction({
          insertedTransaction: {
            isUserOp: false,
            chainId,
            from: fromAddress as Address,
            to: toAddress as Address | undefined,
            data: data as Hex,
            value: BigInt(value),

            gas: maybeBigInt(txOverrides?.gas),
            maxFeePerGas: maybeBigInt(txOverrides?.maxFeePerGas),
            maxPriorityFeePerGas: maybeBigInt(
              txOverrides?.maxPriorityFeePerGas,
            ),
          },
        });
        queueIds.push(queueId);
      }

      reply.status(StatusCodes.OK).send({
        result: {
          queueIds,
        },
      });
    },
  });
}
