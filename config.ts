namespace AWS {
  interface AWSConfig {
    apiVersions: Record<string, string>

    credentials: {
      /** **Access key ID** */
      accessKeyId: string

      /** **Secret access key** */
      secretAccessKey: string
    }

    /**
     * **Region**
     *
     * The Default region name identifies the AWS Region whose servers you want to send your requests to by default. This is typically the Region closest to you, but it can be any Region. For example, you can type us-west-2 to use US West (Oregon). This is the Region that all later requests are sent to, unless you specify otherwise in an individual command.
     */
    region: string
  }

  export const config: AWSConfig = {
    apiVersions: {
      lambda: '2015-03-31'
    },
    credentials: {
      accessKeyId: '',
      secretAccessKey: ''
    },
    region: 'us-west-1'
  }
}
