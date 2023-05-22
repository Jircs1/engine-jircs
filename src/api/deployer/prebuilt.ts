import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getSDK } from "../../helpers/sdk";
import {
  prebuiltDeployParamSchema,
  standardResponseSchema,
} from "../../sharedApiSchemas";
import { logger } from "../../utilities/logger";
import { deployPrebuiltSchema } from "../../schemas/deployer/prebuilt";
import { deployPrebuiltRequestBodySchema } from "../../schemas/deployer/prebuilt";

export async function deployPrebuilt(fastify: FastifyInstance) {
  fastify.route<deployPrebuiltSchema>({
    method: "POST",
    url: "/deployer/:chain_name_or_id/:contract_type",
    schema: {
      description: "Deploy prebuilt contract",
      tags: ["Deploy"],
      operationId: "deployPrebuilt",
      params: prebuiltDeployParamSchema,
      response: standardResponseSchema,
      body: deployPrebuiltRequestBodySchema,
    },
    handler: async (request, reply) => {
      const { chain_name_or_id, contract_type } = request.params;
      const { contractMetadata, version } = request.body;

      logger.info(`Deploying Prebuilt Contract: ${contract_type}`);
      logger.silly(`Chain : ${chain_name_or_id}`);
      logger.silly(`contractMetadata : ${JSON.stringify(contractMetadata)}`);

      const sdk = await getSDK(chain_name_or_id);
      const deployedAddress = await sdk.deployer.deployBuiltInContract(
        contract_type,
        contractMetadata,
        version,
      );
      logger.silly(`deployedAddress : ${deployedAddress}`);

      // TODO unwrap the nesting
      // TODO return the transaction receipt too
      reply.status(StatusCodes.OK).send({
        result: {
          data: deployedAddress,
        },
      });
    },
  });
}
