import { FastifyInstance } from "fastify";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { ZodError } from "zod";
import { env } from "../../utils/env";
import { parseEthersError } from "../../utils/ethers";
import { logger } from "../../utils/logger";

export type CustomError = {
  message: string;
  statusCode: number;
  code: string;
  stack?: string;
};

export const createCustomError = (
  message: string,
  statusCode: number,
  code: string,
): CustomError => ({
  message,
  statusCode,
  code,
});

export const createCustomDateTimestampError = (key: string): CustomError => {
  return createCustomError(
    `Invalid ${key} Value. Needs to new Date() / new Date().toISOstring() / new Date().getTime() / Unix Epoch`,
    404,
    "INVALID_DATE_TIME",
  );
};

const flipObject = (data: any) =>
  Object.fromEntries(Object.entries(data).map(([key, value]) => [value, key]));

const isZodError = (err: unknown): boolean => {
  return Boolean(
    err && (err instanceof ZodError || (err as ZodError).name === "ZodError"),
  );
};

export const withErrorHandler = async (server: FastifyInstance) => {
  server.setErrorHandler(
    (error: Error | CustomError | ZodError, request, reply) => {
      logger({
        service: "server",
        level: "error",
        message: `Encountered server error`,
        error,
      });

      // Ethers Error Codes
      if (parseEthersError(error)) {
        return reply.status(StatusCodes.BAD_REQUEST).send({
          error: {
            code: "BAD_REQUEST",
            message: "code" in error ? error.code : error.message,
            reason: error.message,
            statusCode: 400,
            stack: env.NODE_ENV !== "production" ? error.stack : undefined,
          },
        });
      }

      // Zod Typings Errors
      if (isZodError(error)) {
        const _error = error as ZodError;
        let parsedMessage: any[] = [];

        try {
          parsedMessage = JSON.parse(_error.message);
        } catch (e) {
          console.error("Failed to parse error message:", e);
        }
        const errorObject =
          Array.isArray(parsedMessage) && parsedMessage.length > 0
            ? parsedMessage[0]
            : {};

        return reply.status(StatusCodes.BAD_REQUEST).send({
          error: {
            code: "BAD_REQUEST",
            message: errorObject.message ?? "Invalid Request",
            reason: errorObject ?? undefined,
            statusCode: 400,
            stack: env.NODE_ENV !== "production" ? _error.stack : undefined,
          },
        });
      }

      if ("statusCode" in error && "code" in error) {
        // Transform unexpected errors into a standard payload
        const statusCode =
          error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR;
        const code =
          error.code ??
          flipObject(StatusCodes)[statusCode] ??
          StatusCodes.INTERNAL_SERVER_ERROR;

        const message = error.message ?? ReasonPhrases.INTERNAL_SERVER_ERROR;
        reply.status(statusCode).send({
          error: {
            code,
            message,
            statusCode,
            stack: env.NODE_ENV !== "production" ? error.stack : undefined,
          },
        });
      } else {
        // Handle non-custom errors
        reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
          error: {
            statusCode: 500,
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || ReasonPhrases.INTERNAL_SERVER_ERROR,
            stack: env.NODE_ENV !== "production" ? error.stack : undefined,
          },
        });
      }
    },
  );
};
