declare module "xclienttransaction" {
  export class ClientTransaction {
    constructor(
      homePageResponse: string,
      ondemandFileResponse: string,
      randomKeyword?: string | null,
      randomNumber?: number | null
    );
    generateTransactionId(method: string, path: string): string;
  }
  export function getOndemandFileUrl(html: string): string | null;
  export function generateHeaders(): Record<string, string>;
  export function base64Encode(input: string | Uint8Array): string;
  export function base64Decode(input: string): string;
}
