// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FishGameVault
 * @notice 出海捕鱼上下分金库（参考 CapyGameVault 的签名兑现模式）
 *
 * 设计原则：
 *  1. 游戏本体（捕鱼判定/赔率）跑在服务端，链上只做筹码进出
 *  2. 上分：玩家 deposit 代币进合约 → 后端监听 Deposited 事件给玩家加游戏分
 *  3. 下分：后端验证玩家游戏分后签名，玩家调 claimReward 从奖池领回代币
 *  4. 比例/费率/单笔上限写死在合约里（owner 可调），攻击者改前端/后端无效
 *  5. 奖池由平台预充（fundPool / 直接转账到合约），玩家下分从奖池出
 */
contract FishGameVault {
    /// 游戏代币（如 CAPY），构造时固定
    address public immutable gameToken;
    /// 签名钱包（后端持有私钥），owner 可更换
    address public signer;
    address public owner;

    /// 玩家累计存入
    mapping(address => uint256) public deposited;
    /// 玩家累计领回
    mapping(address => uint256) public claimed;
    /// 防重放 nonce
    mapping(address => uint256) public nonces;

    /// 单笔下分上限（代币 wei 单位），0 = 不限制
    uint256 public maxClaimPerTx;
    /// 单地址每日下分上限（UTC 自然日），0 = 不限制
    uint256 public dailyClaimCap;
    mapping(address => uint256) public dailyClaimed;
    mapping(address => uint256) public lastClaimDay;

    bool public paused;

    event Deposited(address indexed player, uint256 amount, uint256 totalDeposited);
    event Claimed(address indexed player, uint256 amount, uint256 nonce);
    event SignerUpdated(address indexed newSigner);
    event OwnerUpdated(address indexed newOwner);
    event MaxClaimPerTxUpdated(uint256 value);
    event DailyClaimCapUpdated(uint256 value);
    event PausedChanged(bool paused);
    event Funded(address indexed from, uint256 amount);

    error OnlyOwner();
    error ZeroAddress();
    error InvalidAmount();
    error Paused();
    error InvalidSignature();
    error Expired();
    error InvalidNonce();
    error ClaimCapExceeded();
    error DailyCapExceeded();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address token_, address signer_, uint256 maxClaimPerTx_, uint256 dailyClaimCap_) {
        if (token_ == address(0) || signer_ == address(0)) revert ZeroAddress();
        gameToken = token_;
        signer = signer_;
        owner = msg.sender;
        maxClaimPerTx = maxClaimPerTx_;
        dailyClaimCap = dailyClaimCap_;
    }

    // ───────── 上分 ─────────

    /// 玩家存代币上分：从玩家钱包转 amount 到金库，后端监听事件加游戏分
    function deposit(uint256 amount) external {
        if (paused) revert Paused();
        if (amount == 0) revert InvalidAmount();
        deposited[msg.sender] += amount;
        if (!IERC20(gameToken).transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        emit Deposited(msg.sender, amount, deposited[msg.sender]);
    }

    // ───────── 下分 ─────────

    /// 玩家凭后端签名从奖池领回代币
    function claimReward(
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        if (paused) revert Paused();
        if (amount == 0) revert InvalidAmount();
        if (block.timestamp > deadline) revert Expired();
        if (nonce != nonces[msg.sender]) revert InvalidNonce();

        // 单笔上限
        if (maxClaimPerTx > 0 && amount > maxClaimPerTx) revert ClaimCapExceeded();

        // 每日上限（按 UTC 自然日）
        uint256 day = block.timestamp / 1 days;
        if (dailyClaimCap > 0) {
            uint256 usedToday = lastClaimDay[msg.sender] == day ? dailyClaimed[msg.sender] : 0;
            if (usedToday + amount > dailyClaimCap) revert DailyCapExceeded();
            dailyClaimed[msg.sender] = usedToday + amount;
            lastClaimDay[msg.sender] = day;
        }

        // 验签：必须是后端签发的（chainId, vault, player, amount, nonce, deadline）
        bytes32 digest = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                msg.sender,
                amount,
                nonce,
                deadline
            )
        );
        address recovered = recover(digest, signature);
        if (recovered != signer) revert InvalidSignature();

        nonces[msg.sender] = nonce + 1;
        claimed[msg.sender] += amount;

        if (!IERC20(gameToken).transfer(msg.sender, amount)) {
            revert TransferFailed();
        }
        emit Claimed(msg.sender, amount, nonce);
    }

    // ───────── 视图 ─────────

    /// 链上可查的「净存入 = 累计存入 - 累计领回」（参考值，游戏分权威在服务端）
    function availableBalance(address player) external view returns (uint256) {
        return deposited[player] - claimed[player];
    }

    /// 金库代币余额（奖池）
    function poolBalance() external view returns (uint256) {
        return IERC20(gameToken).balanceOf(address(this));
    }

    // ───────── 管理 ─────────

    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        signer = newSigner;
        emit SignerUpdated(newSigner);
    }

    function setMaxClaimPerTx(uint256 value) external onlyOwner {
        maxClaimPerTx = value;
        emit MaxClaimPerTxUpdated(value);
    }

    function setDailyClaimCap(uint256 value) external onlyOwner {
        dailyClaimCap = value;
        emit DailyClaimCapUpdated(value);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PausedChanged(value);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
        emit OwnerUpdated(newOwner);
    }

    /// 平台预充奖池
    function fundPool(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidAmount();
        if (!IERC20(gameToken).transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        emit Funded(msg.sender, amount);
    }

    function recover(bytes32 digest, bytes memory signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return address(0);
        }
        return ecrecover(digest, v, r, s);
    }
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
