import { StatusCodes } from 'http-status-codes';

export class RequestError extends Error {
  public readonly status: number;

  public constructor(message: string, status: number = StatusCodes.BAD_REQUEST) {
    super(message);

    this.status = status;
  }
}
