import type { Securefields } from "@purse-eu/web-sdk";
type SubmitResult = Securefields.SubmitResult;

function isTokenizationError(
  tokenizationResult: SubmitResult,
): tokenizationResult is { error?: string } {
  return (tokenizationResult as any).error !== undefined;
}

export const TokenizationResultDisplay = ({
  tokenizationResult,
}: {
  tokenizationResult: SubmitResult;
}) => {
  if (!tokenizationResult) {
    return null;
  }

  if (isTokenizationError(tokenizationResult)) {
    return (
      <div
        className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mt-4"
        role="alert"
      >
        <strong className="font-bold">Tokenization Error:</strong>
        <span className="block sm:inline">
          {" "}
          {JSON.stringify(tokenizationResult.error)}
        </span>
      </div>
    );
  }

  return (
    <div
      className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mt-4"
      role="alert"
    >
      <strong className="font-bold">Tokenization Successful!</strong>
      <div className="bg-black text-white rounded-lg p-6 space-y-4 shadow-md">
        <div className="flex items-center space-x-2">
          <span className="font-semibold">Token:</span>
          <span className="font-mono break-all">
            {tokenizationResult.vault_form_token}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-semibold">Bin:</span>
          <span className="font-mono">{tokenizationResult.card?.bin}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-semibold">Last 4:</span>
          <span className="font-mono">
            {tokenizationResult.card?.last_four_digits}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-semibold">Detected Brands:</span>
          <span className="font-mono">
            {JSON.stringify(tokenizationResult.card?.detected_brands ?? [])}
          </span>
        </div>
      </div>
    </div>
  );
};
