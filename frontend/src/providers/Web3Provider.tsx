import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { sepolia } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'
import type { ReactNode } from 'react'

const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID

if (!projectId) {
  throw new Error(
    'Missing VITE_WALLET_CONNECT_PROJECT_ID — copy frontend/.env.example to frontend/.env and set it. ' +
      'Get a project ID at https://cloud.reown.com.'
  )
}

const metadata = {
  name: 'Web3 Platform',
  description: 'Real Estate Tokenization MVP',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
}

/**
 * Local Hardhat development network (chain ID 31337 — Hardhat default).
 * Contracts are deployed here — this is the primary network for development.
 */
const localhost: AppKitNetwork = {
  id: 31337,
  name: 'Hardhat Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public:  { http: ['http://127.0.0.1:8545'] }
  },
  chainNamespace: 'eip155'
}

/**
 * Supported networks:
 *  - localhost (chain 31337) — local Hardhat node, contracts deployed here
 *  - sepolia   (chain 11155111) — public testnet (no contracts deployed yet)
 */
createAppKit({
  adapters: [new EthersAdapter()],
  networks: [localhost, sepolia],
  defaultNetwork: localhost,
  metadata,
  projectId,
  features: {
    analytics: false
  }
})

export function Web3ModalProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
