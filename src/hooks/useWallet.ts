import { useState, useEffect, useCallback, useRef } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { BSC_RPC_URL } from "@/lib/ido";

export const BSC_CHAIN_ID = 56;

const BSC_NETWORK_PARAMS = {
  chainId: "0x38",
  chainName: "BNB Smart Chain Mainnet",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: [BSC_RPC_URL],
  blockExplorerUrls: ["https://bscscan.com"],
};

interface WalletState {
  account: string | null;
  signer: JsonRpcSigner | null;
  isConnected: boolean;
  isBSC: boolean;
  balance: string;
}

function getEth() {
  return window.ethereum;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    account: null,
    signer: null,
    isConnected: false,
    isBSC: false,
    balance: "0",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const hasMetaMask = typeof window !== "undefined" && Boolean(window.ethereum);

  const refreshBalance = useCallback(async (provider: BrowserProvider, address: string) => {
    try {
      const raw = await provider.getBalance(address);
      if (mounted.current) {
        const bnb = Number(raw) / 1e18;
        setState((prev) => ({
          ...prev,
          balance: bnb >= 1 ? bnb.toFixed(2) : bnb.toFixed(4),
        }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const updateFromProvider = useCallback(
    async (eth: NonNullable<ReturnType<typeof getEth>>, provider: BrowserProvider) => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[] | undefined;
        if (!accounts || accounts.length === 0) {
          setState((prev) => ({ ...prev, account: null, signer: null, isConnected: false }));
          return;
        }
        const signer = await provider.getSigner();
        const network = await provider.getNetwork();
        const isBSC = Number(network.chainId) === BSC_CHAIN_ID;
        setState((prev) => ({
          ...prev,
          account: accounts[0],
          signer,
          isConnected: true,
          isBSC,
        }));
        void refreshBalance(provider, accounts[0]);
      } catch {
        /* ignore */
      }
    },
    [refreshBalance],
  );

  const connectWallet = useCallback(async () => {
    if (!hasMetaMask) {
      setError("未检测到 MetaMask，请安装后重试");
      return;
    }
    const eth = getEth()!;
    setLoading(true);
    setError(null);
    try {
      await eth.request({ method: "eth_requestAccounts" });
      const provider = new BrowserProvider(eth);
      await updateFromProvider(eth, provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "连接钱包失败");
    } finally {
      setLoading(false);
    }
  }, [hasMetaMask, updateFromProvider]);

  const switchToBSC = useCallback(async () => {
    if (!hasMetaMask) return;
    const eth = getEth()!;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x38" }] });
    } catch (switchError: unknown) {
      const code = (switchError as { code?: number }).code;
      if (code === 4902) {
        try {
          await eth.request({ method: "wallet_addEthereumChain", params: [BSC_NETWORK_PARAMS] });
        } catch {
          setError("添加 BSC 网络失败");
        }
      } else {
        setError("切换网络失败");
      }
    }
  }, [hasMetaMask]);

  useEffect(() => {
    mounted.current = true;
    if (!hasMetaMask) return;
    const eth = getEth()!;
    const provider = new BrowserProvider(eth);
    void updateFromProvider(eth, provider);
    const handleAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length === 0) {
        setState((prev) => ({ ...prev, account: null, signer: null, isConnected: false, balance: "0" }));
      } else {
        void updateFromProvider(eth, provider);
      }
    };
    eth.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      mounted.current = false;
      eth.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [hasMetaMask, updateFromProvider]);

  return {
    ...state,
    loading,
    error,
    hasMetaMask,
    connectWallet,
    switchToBSC,
  };
}
