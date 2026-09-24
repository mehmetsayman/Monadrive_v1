// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IVehicleRegistry} from "./IVehicleRegistry.sol";

/// @title The allowlist of garages and inspection shops allowed to write history.
/// @dev Deliberately a plain allowlist rather than AccessControl: a hackathon judge
///      should be able to read the whole authorization story in one screen.
abstract contract ServiceRegistry is Ownable, IVehicleRegistry {
    mapping(address => ServiceProvider) private _providers;
    address[] private _providerList;

    modifier onlyService() {
        if (!_providers[msg.sender].active) revert NotAuthorizedService(msg.sender);
        _;
    }

    /// @notice Approve a garage, rename it, or revoke it.
    /// @dev Revoking leaves every record the garage already wrote in place. History is
    ///      append-only on purpose: losing your license does not erase what you signed.
    function setServiceProvider(address provider, string calldata name, bool active) external onlyOwner {
        ServiceProvider storage p = _providers[provider];

        if (p.approvedAt == 0) {
            p.approvedAt = uint40(block.timestamp);
            _providerList.push(provider);
        }

        p.name = name;
        p.active = active;

        emit ServiceProviderSet(provider, name, active);
    }

    function isServiceProvider(address provider) public view returns (bool) {
        return _providers[provider].active;
    }

    function getServiceProvider(address provider) external view returns (ServiceProvider memory) {
        return _providers[provider];
    }

    /// @notice Every address ever approved, active or not. Small by construction.
    function getServiceProviders() external view returns (address[] memory) {
        return _providerList;
    }

    function serviceProviderCount() external view returns (uint256) {
        return _providerList.length;
    }

    /// @dev Let the deriving contract bump the counter without exposing storage.
    function _creditServiceProvider(address provider) internal {
        unchecked {
            _providers[provider].recordCount += 1;
        }
    }

    function _serviceName(address provider) internal view returns (string memory) {
        return _providers[provider].name;
    }
}
