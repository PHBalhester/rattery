// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISeasonBurnable { function burn(uint256 amount) external; }

/// @notice One immutable season. Local candidate; not deployed or enabled in the application.
/// @dev No arbitrary calls, payouts, custody withdrawals, token changes or resident mutations.
contract SeasonActions is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;
    enum Kind { Entry, Feed, Shield, Attack }
    struct Quote {
        bytes32 season;
        address wallet;
        uint256 nonce;
        uint256 membership;
        Kind kind;
        uint8 nest;
        uint256 amount;
        uint256 usdCents;
        uint64 issuedAt;
        uint64 expiresAt;
    }
    struct Member { uint256 id; uint8 nest; }
    struct Nest {
        uint256 score;
        uint256 gross;
        uint64 lastProduction;
        uint64 shieldUntil;
        uint64 shieldReady;
        uint64 attackReady;
        uint8 halfPoint;
    }
    bytes32 public constant QUOTE_TYPEHASH = keccak256("Quote(bytes32 season,address wallet,uint256 nonce,uint256 membership,uint8 kind,uint8 nest,uint256 amount,uint256 usdCents,uint64 issuedAt,uint64 expiresAt)");
    IERC20 public immutable token;
    address public immutable quoteSigner;
    address public immutable operator;
    bytes32 public immutable season;
    uint64 public immutable opensAt;
    uint64 public immutable closesAt;
    /// @notice Explicit deployment choice; product decision still pending.
    bool public immutable honorEntryQuote;
    bool public paused;
    uint256 public nextMembership = 1;
    uint32 public colonySlot;
    event ColonyPoints(uint32 indexed slot, int8 nvda, int8 aapl, int8 amzn);
    mapping(address => uint256) public nonces;
    mapping(address => Member) public members;
    mapping(uint256 => uint256) public contributions;
    mapping(address => uint256) public extraFeeds;
    mapping(uint8 => Nest) public nests;
    event PauseChanged(bool paused);
    event ActionExecuted(
        bytes32 indexed quoteHash, address indexed wallet, uint256 indexed membership,
        uint256 nonce, uint8 kind, uint8 nest, uint256 amount, uint256 usdCents,
        uint256 points, uint256 damage, bool blocked
    );
    error InvalidConfig();
    error InvalidQuote();
    error InvalidSignature();
    error NotOpen();
    error Unavailable();
    error BurnMismatch();
    error Unauthorized();

    constructor(address token_, address signer_, bytes32 season_, uint64 open_, uint64 close_, bool honorEntryQuote_)
        EIP712("RATTERY Season Actions", "1")
    {
        if (token_.code.length == 0 || signer_ == address(0) || season_ == bytes32(0) || open_ <= block.timestamp || close_ <= open_ || close_ - open_ <= 5 hours) revert InvalidConfig();
        token = IERC20(token_); quoteSigner = signer_; operator = msg.sender;
        season = season_; opensAt = open_; closesAt = close_; honorEntryQuote = honorEntryQuote_;
    }

    function setPaused(bool value) external {
        if (msg.sender != operator) revert Unauthorized();
        paused = value; emit PauseChanged(value);
    }

    // Exactly one authoritative colony observation per ten-minute interval.
    // Half-point units preserve +0.5/-0.5 without floating-point rounding.
    function applyColonyPoints(uint32 slot, int8[3] calldata deltas) external {
        if (msg.sender != quoteSigner && msg.sender != operator) revert Unauthorized();
        if (slot != colonySlot + 1 || block.timestamp < opensAt + uint256(slot) * 10 minutes ||
            uint256(slot) * 10 minutes > closesAt - opensAt) revert Unavailable();
        for (uint8 i = 0; i < 3; i++) {
            int8 d = deltas[i];
            if (d != -4 && d != -2 && d != -1 && d != 0 && d != 1 && d != 2 && d != 4) revert InvalidConfig();
            Nest storage n = nests[i + 1];
            uint256 halves = n.score * 2 + n.halfPoint;
            if (d < 0) { uint256 loss = uint256(int256(-d)); halves = loss >= halves ? 0 : halves - loss; }
            else halves += uint8(d);
            n.score = halves / 2; n.halfPoint = uint8(halves % 2);
        }
        colonySlot = slot; emit ColonyPoints(slot, deltas[0], deltas[1], deltas[2]);
    }

    function entryPrice(uint256 time) public view returns (uint256) {
        if (time < opensAt || time >= closesAt) revert NotOpen();
        uint256 remaining = closesAt - time;
        return remaining > 72 hours ? 1000 : remaining > 36 hours ? 1500 : remaining > 12 hours ? 2000 : 3000;
    }

    function quoteDigest(Quote calldata q) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            QUOTE_TYPEHASH, q.season, q.wallet, q.nonce, q.membership, q.kind,
            q.nest, q.amount, q.usdCents, q.issuedAt, q.expiresAt
        )));
    }

    function execute(Quote calldata q, bytes calldata signature) external nonReentrant {
        if (paused || block.timestamp < opensAt || block.timestamp >= closesAt) revert NotOpen();
        if (colonySlot != (block.timestamp - opensAt) / 10 minutes) revert Unavailable();
        if (q.wallet != msg.sender || q.season != season || q.nonce != nonces[msg.sender] ||
            q.amount == 0 || q.nest < 1 || q.nest > 3 || q.issuedAt < opensAt ||
            q.issuedAt > block.timestamp || q.expiresAt <= q.issuedAt ||
            q.expiresAt - q.issuedAt > 60 || block.timestamp >= q.expiresAt) revert InvalidQuote();
        bytes32 digest = quoteDigest(q);
        if (ECDSA.recover(digest, signature) != quoteSigner) revert InvalidSignature();
        Member storage member = members[msg.sender];
        if (q.membership != member.id) revert InvalidQuote();
        uint256 expected = q.kind == Kind.Entry ? entryPrice(honorEntryQuote ? q.issuedAt : block.timestamp)
            : q.kind == Kind.Feed ? 200 : q.kind == Kind.Shield ? 1000 : 2000;
        if (q.usdCents != expected) revert InvalidQuote();
        uint256 points; uint256 damage; bool blocked;
        Nest storage target = nests[q.nest];
        if (q.kind == Kind.Entry) {
            if (member.id != 0 && (block.timestamp >= closesAt - 5 hours || member.nest == q.nest)) revert Unavailable();
            member.id = nextMembership++; member.nest = q.nest;
            points = 100;
        } else {
            if (member.id == 0) revert Unavailable();
            Nest storage own = nests[member.nest];
            if (q.kind == Kind.Feed) {
                if (q.nest != member.nest) revert Unavailable();
                points = 20; extraFeeds[msg.sender]++;
            } else if (q.kind == Kind.Shield) {
                if (q.nest != member.nest || block.timestamp < own.shieldReady || block.timestamp < own.shieldUntil) revert Unavailable();
                own.shieldUntil = uint64(block.timestamp + 15 minutes);
                own.shieldReady = uint64(block.timestamp + 30 minutes);
            } else {
                if (q.nest == member.nest || block.timestamp < own.attackReady) revert Unavailable();
                own.attackReady = uint64(block.timestamp + 60 minutes);
                blocked = block.timestamp < target.shieldUntil;
                if (blocked) target.shieldUntil = 0;
                else { damage = target.score / 10; if (damage > 500) damage = 500; target.score -= damage; }
            }
        }
        if (points != 0) {
            target.score += points; target.gross += points;
            target.lastProduction = uint64(block.timestamp); contributions[member.id] += points;
        }
        nonces[msg.sender]++;
        // All validation and gameplay mutations revert together if transfer/burn fails.
        uint256 walletBefore = token.balanceOf(msg.sender);
        uint256 routerBefore = token.balanceOf(address(this));
        uint256 supplyBefore = token.totalSupply();
        token.safeTransferFrom(msg.sender, address(this), q.amount);
        if (token.balanceOf(address(this)) != routerBefore + q.amount) revert BurnMismatch();
        ISeasonBurnable(address(token)).burn(q.amount);
        if (token.balanceOf(address(this)) != routerBefore ||
            token.balanceOf(msg.sender) + q.amount != walletBefore ||
            token.totalSupply() + q.amount != supplyBefore) revert BurnMismatch();
        emit ActionExecuted(digest, msg.sender, member.id, q.nonce, uint8(q.kind), q.nest, q.amount, q.usdCents, points, damage, blocked);
    }
}
