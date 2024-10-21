import crypto, { randomBytes } from 'crypto'
import { deflateSync } from 'zlib'

const sessionSecret = () => {
    return crypto.randomBytes(32).toString('hex')
}

export default sessionSecret