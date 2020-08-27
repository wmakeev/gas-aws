namespace AWS {
  export type HttpMethod = 'get' | 'delete' | 'patch' | 'post' | 'put'

  function assert(cond: boolean, msg: string) {
    if (!cond) {
      throw new Error(msg)
    }
  }

  /**
   * Returns signature for request
   * http://docs.aws.amazon.com/general/latest/gr/signature-v4-examples.html
   * @param {string} key Your secret access key
   * @param {string} dateStamp Date in YYYYMMDD format
   * @param {string} regionName AWS region (e.g. 'us-east-1')
   * @param {string} serviceName AWS service name (e.g. 'ec2', 'iam', 'codecommit')
   * @param {string} stringToSign String to sign
   * @returns {string} Signed string
   */
  function calculateSignature(
    key: string,
    dateStamp: string,
    regionName: string,
    serviceName: string,
    stringToSign: string
  ) {
    const HmacSHA256 = Crypto.HmacSHA256

    const kDate = HmacSHA256(dateStamp, 'AWS4' + key, { asBytes: true })
    const kRegion = HmacSHA256(regionName, kDate, { asBytes: true })
    const kService = HmacSHA256(serviceName, kRegion, { asBytes: true })
    const kSigning = HmacSHA256('aws4_request', kService, { asBytes: true })

    return HmacSHA256(stringToSign, kSigning, { asBytes: false })
  }

  /**
   * Extract number values from ISO date string (https://regex101.com/r/5Ysvdf/1)
   */
  const DATE_VALUES_REGEX = new RegExp(
    /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  )

  /**
   * Return date and time string
   * @param {Date} date Date
   * @returns {string} Date formated to YYYYMMDDTHHmmssZ
   */
  function getCanonicalFullDate(date: Date) {
    const match = DATE_VALUES_REGEX.exec(date.toISOString())!
    return (
      match[1] +
      match[2] +
      match[3] +
      'T' +
      match[4] +
      match[5] +
      match[6] +
      'Z'
    )
  }

  /**
   * Return date string
   * @param {Date} date Date
   * @returns {string} Date formated to YYYYMMDD
   */
  function getCanonicalShortDate(date: Date) {
    const match = DATE_VALUES_REGEX.exec(date.toISOString())!
    return match[1] + match[2] + match[3]
  }

  /**
   * Returns canonical query string
   * @param {object} query Query key-value object
   * @returns {string} Canonical query string
   */
  function getCanonicalQueryString(query: Record<string, any>) {
    let key
    const queryParts = []

    for (key in query) {
      if (!query.hasOwnProperty(key)) continue
      queryParts.push([key, query[key]])
    }

    return queryParts
      .map(part => {
        const value = part[1] != null ? part[1] : ''
        return (
          encodeURIComponent(part[0].trim()) + '=' + encodeURIComponent(value)
        )
      })
      .sort((a, b) => {
        if (a === b) return 0
        return a > b ? 1 : -1
      })
      .join('&')
  }

  /**
   * Returns hashed canonical request
   * @param {string} method HTTP method
   * @param {string} path Request path
   * @param {object} headers Request headers
   * @param {string} queryString Request query string
   * @param {string} payloadString Request payload as string
   * @returns {{
       hashedCanonicalRequest: string,
      signedHeaders: string
    }} hashed canonical request and signed headers
  */
  function getCanonicalRequestHash(
    method: HttpMethod,
    path: string,
    headers: Record<string, string>,
    queryString: string,
    payloadString: string
  ) {
    const canonicalHeaders = [] as string[]
    const signedHeaders = [] as string[]

    Object.keys(headers)
      .map(key => [key, headers[key]])
      .map(header => [
        header[0].trim().toLowerCase(),
        header[1].trim().replace(/\s{2,}/g, ' ')
      ])
      .sort((a, b) => {
        if (a[0] === b[0]) return 0
        else return a[0] > b[0] ? 1 : -1
      })
      .forEach(header => {
        canonicalHeaders.push(header[0] + ':' + header[1] + '\n')
        signedHeaders.push(header[0])
      })

    const canonicalHeadersStr = canonicalHeaders.join('')
    const signedHeadersStr = signedHeaders.join(';')
    const normalizedPath = path
      .split(/\//g)
      .map(part => encodeURIComponent(part))
      .join('/')

    const canonicalRequest = [
      method,
      normalizedPath,
      queryString,
      canonicalHeadersStr,
      signedHeadersStr,
      Crypto.SHA256(payloadString)
    ].join('\n')

    return {
      hashedCanonicalRequest: Crypto.SHA256(canonicalRequest),
      signedHeaders: signedHeadersStr
    }
  }

  /**
   * AWS hash algorithm name
   */
  const HASH_ALGORITHM = 'AWS4-HMAC-SHA256'

  const AWS_SINGLE_ENDPOINT: Record<string, string> = {
    cloudfront: 'cloudfront.amazonaws.com',
    health: 'health.us-east-1.amazonaws.com',
    iam: 'iam.amazonaws.com',
    importexport: 'importexport.amazonaws.com',
    shield: 'shield.us-east-1.amazonaws.com',
    waf: 'waf.amazonaws.com'
  }

  const getCurrentDate = function () {
    return new Date()
  }

  /** The AWS service request parameters */
  export interface RequestParams {
    /** AWS access key */
    accessKeyId?: string

    /** AWS secret key */
    secretAccessKey?: string

    /** The AWS service to connect to (e.g. 'ec2', 'iam', 'codecommit') */
    service: string

    /**
     * The aws region your command will go to.
     *
     * default: `us-east-1`.
     * */
    region?: string

    /**
     * The path to api function (without query).
     *
     * default: `/`.
     * */
    path?: string

    /** The query string parameters */
    query?: Record<string, string | number>

    /**
     * The http method (e.g. 'get', 'post').
     *
     * default: `GET`
     * */
    method?: HttpMethod

    /** The headers to attach to the request. Host and X-Amz-Date are premade
   for you. */
    headers?: Record<string, string>

    /**
     * The payload to send.
     *
     * default: empty string */
    payload: string | object
  }

  /** Authenticates and sends the given parameters for an AWS api request. */
  export function request(params: RequestParams) {
    let temp

    const accessKeyId = params.accessKeyId ?? AWS.config.credentials.accessKeyId

    assert(accessKeyId != null, 'AWS access key id not specified')

    const secretAccessKey =
      params.secretAccessKey ?? AWS.config.credentials.secretAccessKey

    assert(secretAccessKey != null, 'AWS secret access key not specified')

    const service = params.service.toLowerCase()

    assert(service != null, 'AWS service not specified')

    const region = params.region
      ? params.region.toLowerCase()
      : AWS.config.region

    assert(region != null, 'AWS region not specified')

    let path = params.path ?? '/'

    const query = params.query ?? {}

    // method should be in upper case
    const method = (params.method ?? 'get').toUpperCase() as HttpMethod

    const headers = params.headers ?? {}

    const payload = params.payload ?? ''

    const host = AWS_SINGLE_ENDPOINT[service]
      ? AWS_SINGLE_ENDPOINT[service]
      : service + '.' + region + '.amazonaws.com'

    if (path.substring(0, 1) !== '/') {
      path = '/' + path
    }

    const payloadString =
      typeof payload === 'string' ? payload : JSON.stringify(payload)

    const curDate = getCurrentDate()
    const dateStringFull = getCanonicalFullDate(curDate) // 20150830T123600Z
    const dateStringShort = getCanonicalShortDate(curDate) // 20150830
    const queryString = getCanonicalQueryString(query)

    headers['Host'] = host
    headers['X-Amz-Date'] = dateStringFull

    // Task 1: Create a Canonical Request for Signature
    // http://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html

    temp = getCanonicalRequestHash(
      method,
      path,
      headers,
      queryString,
      payloadString
    )
    const hashedCanonicalRequest = temp.hashedCanonicalRequest
    const signedHeaders = temp.signedHeaders

    // Task 2: Create a String to Sign for Signature
    // http://docs.aws.amazon.com/general/latest/gr/sigv4-create-string-to-sign.html

    const credentialScope =
      dateStringShort + '/' + region + '/' + service + '/aws4_request'

    const stringToSign = [
      HASH_ALGORITHM,
      dateStringFull,
      credentialScope,
      hashedCanonicalRequest
    ].join('\n')

    // Task 3: Calculate the Signature
    // http://docs.aws.amazon.com/general/latest/gr/sigv4-calculate-signature.html

    const signature = calculateSignature(
      secretAccessKey,
      dateStringShort,
      region,
      service,
      stringToSign
    )

    // Task 4: Add the Signing Information to the Request
    // http://docs.aws.amazon.com/general/latest/gr/sigv4-add-signature-to-request.html

    headers['Authorization'] = [
      HASH_ALGORITHM + ' Credential=' + accessKeyId + '/' + credentialScope,
      'SignedHeaders=' + signedHeaders,
      'Signature=' + signature
    ].join(', ')

    // Sending request

    delete headers['Host'] // fetch will add Host header
    const fetchOptions = {
      method,
      headers,
      muteHttpExceptions: true,
      payload: payloadString
    }

    const uri =
      'https://' + host + path + (queryString ? '?' + queryString : '')

    return UrlFetchApp.fetch(uri, fetchOptions)
  }
}
