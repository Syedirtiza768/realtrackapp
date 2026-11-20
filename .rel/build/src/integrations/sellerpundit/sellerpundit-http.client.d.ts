import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class SellerpunditHttpClient {
    private readonly config;
    constructor(config: ConfigService);
    authBaseUrl(): string;
    marketplacesBaseUrl(): string;
    login(email: string, password: string): Promise<string>;
    get<T>(jwt: string, path: string, query?: Record<string, string>): Promise<T>;
    post<T>(jwt: string, path: string, body: unknown): Promise<T>;
    private requestWithGatewayRetry;
    fromAxios(err: unknown): never;
    private fromAxiosError;
    toError(httpStatus: number, message: string): HttpException;
}
