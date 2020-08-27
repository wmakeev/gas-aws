namespace AWS {
  /**
   * URI Request Parameters
   *
   * [API_Invoke](https://docs.aws.amazon.com/lambda/latest/dg/API_Invoke.html)
   */
  export interface LambdaInvokeParams {
    /** Data about the invoking client to pass to the function in the context object. */
    ClientContext?: object

    /**
     * The name of the Lambda function, version, or alias.
     *
     * **Name formats**
     * - **Function name** - `my-function` (name-only), `my-function:v1` (with alias).
     * - **Function ARN** - `arn:aws:lambda:us-west-2:123456789012:function:my-function`.
     * - **Partial ARN** - `123456789012:function:my-function`.
     * */
    FunctionName: string

    /**
     * The JSON that you want to provide to your Lambda function as input.
     *
     * // TODO: Buffer?
     * */
    Payload: string | object

    /**
     * Choose from the following options.
     *
     * - `RequestResponse` (default) - Invoke the function synchronously. Keep the connection open until the function returns a response or times out. The API response includes the function response and additional data.
     * - `Event` - Invoke the function asynchronously. Send events that fail multiple times to the function's dead-letter queue (if it's configured). The API response only includes a status code.
     * - `DryRun` - Validate parameter values and verify that the user or role has permission to invoke the function.
     * */
    InvocationType?: `Event` | `RequestResponse` | `DryRun`

    /** Set to `Tail` to include the execution log in the response. */
    LogType?: `None` | `Tail`

    /** Specify a version or alias to invoke a published version of the function. */
    Qualifier?: string
  }

  export class Lambda {
    invoke(params: LambdaInvokeParams) {
      const path =
        `/${AWS.config.apiVersions.lambda}/functions/` +
        encodeURI(params.FunctionName) +
        '/invocations'

      const headers = {
        'Content-Type': 'application/json; charset=utf-8'
      }

      const query: Record<string, string> = {}

      if (params.ClientContext) {
        query.ClientContext = Utilities.base64Encode(
          JSON.stringify(params.ClientContext)
        )
      }

      if (params.InvocationType) {
        query.InvocationType = params.InvocationType
      }

      if (params.LogType) {
        query.LogType = params.LogType
      }

      if (params.Qualifier) {
        query.Qualifier = params.Qualifier
      }

      const requestParams: AWS.RequestParams = {
        service: 'lambda',
        path,
        method: 'post',
        headers,
        payload: params.Payload,
        query
      }

      const response = AWS.request(requestParams)

      const respCode = response.getResponseCode()
      const respHeaders = response.getAllHeaders() as Record<string, string>
      const respPayload = JSON.parse(response.getContentText())

      const logResult = respHeaders['X-Amz-Log-Result']

      const result = {
        StatusCode: respCode,
        ExecutedVersion: respHeaders['X-Amz-Executed-Version'],
        LogResult: logResult ? Utilities.base64Decode(logResult) : undefined,
        Payload: respPayload
      }

      if (result.StatusCode < 200 || result.StatusCode > 299) {
        const message = result.Payload?.errorMessage || result.Payload?.message

        console.error(JSON.stringify(result, null, 2))
        // TODO AWSLambdaError
        throw new Error(message)
      }

      return result
    }
  }
}
