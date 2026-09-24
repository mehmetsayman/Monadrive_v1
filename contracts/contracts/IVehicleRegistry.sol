// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title MonadDrive vehicle registry types, events and errors.
interface IVehicleRegistry {
    /// @dev The kind of work a record describes. The order is part of the ABI:
    ///      append new kinds at the end, never insert in the middle.
    enum RecordType {
        Maintenance, // 0 - periyodik bakim
        Repair, // 1 - onarim
        PartReplacement, // 2 - parca degisimi
        Inspection, // 3 - muayene / ekspertiz
        Accident, // 4 - kaza kaydi
        HeavyDamage // 5 - agir hasar
    }

    /// @dev Packed into a single storage slot (5 + 2 + 4 + 1 + 20 = 32 bytes).
    ///
    ///      `recordedAt` and `serviceDay` are deliberately different things: when
    ///      the chain accepted the record, and when the work was actually done. A
    ///      garage entering last month's job today must not have that job dated
    ///      today, or every history collapses onto the day it was typed in.
    ///
    ///      `serviceDay` counts whole days since the Unix epoch - all the
    ///      precision a service date needs, and what makes the slot fit. uint16
    ///      carries it to the year 2149.
    struct Record {
        uint40 recordedAt;
        uint16 serviceDay;
        uint32 mileage;
        uint8 recordType;
        address reporter;
        string ipfsCid; // photo / invoice bundle, empty string when none
        string note;
    }

    /// @dev Also a single slot (5 + 4 + 2 + 2 + 4 + 2 + 5 + 1 = 25 bytes).
    struct Vehicle {
        uint40 mintedAt;
        uint32 lastMileage;
        uint16 damagePoints; // monotonically increasing, never forgiven
        uint16 carePoints; // capped when the score is computed
        uint32 recordCount;
        uint16 accidentCount;
        uint40 lastUpdatedAt;
        bool registered;
    }

    struct ServiceProvider {
        string name;
        uint32 recordCount;
        uint40 approvedAt;
        bool active;
    }

    event VehicleRegistered(
        uint256 indexed tokenId, bytes32 indexed vinHash, address indexed registrar, uint32 initialMileage
    );

    event RecordAdded(
        uint256 indexed tokenId,
        address indexed reporter,
        uint32 indexed index,
        RecordType recordType,
        uint32 mileage,
        uint16 serviceDay,
        string ipfsCid
    );

    event ServiceProviderSet(address indexed provider, string name, bool active);

    /// @dev The one guarantee the whole product rests on.
    error MileageRollback(uint32 recorded, uint32 submitted);
    error NotAuthorizedService(address caller);
    error VehicleNotFound(uint256 tokenId);
    error VehicleAlreadyRegistered(uint256 tokenId);
    error EmptyVin();
    error InvalidRecordType(uint8 recordType);

    /// @dev Work cannot have been done tomorrow.
    error FutureServiceDate(uint16 today, uint16 submitted);
}
