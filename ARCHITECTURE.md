# Specify Extension Architecture

This document describes the clean, modular architecture of the VS Code Specify extension after refactoring.

## Architecture Overview

The extension has been refactored from a single monolithic file into a clean, maintainable architecture with proper separation of concerns:

```
src/
├── extension.ts              # Main entry point (activate/deactivate)
├── extensionActivator.ts     # Coordinates all components
├── types.ts                  # TypeScript interfaces and types
├── specFileManager.ts        # File operations and path resolution
├── specParser.ts             # Parses spec.md files into structured data
├── providers.ts              # Tree data providers for VS Code views
├── commandManager.ts         # Handles all extension commands
└── copilotIntegration.ts     # GitHub Copilot Chat integration
```

## Core Components

### 1. Types and Interfaces (`types.ts`)

Defines all TypeScript interfaces and types used throughout the extension:

- **Core Types**: `SectionType`, `ImplementationStatus`, `SpecSectionFilter`
- **Data Structures**: `ParsedSection`, `Runner`, `CommandConfig`
- **Service Interfaces**: `ISpecFileManager`, `ISpecParser`, `ICommandManager`, `ICopilotIntegration`

### 2. SpecFileManager (`specFileManager.ts`)

Handles all file system operations related to spec files:

- **Path Resolution**: Finds `spec.md` files in workspace
- **File Operations**: Reading, existence checking, caching
- **File Watching**: Monitors changes and notifies consumers
- **Workspace Management**: Resolves workspace root paths

**Key Methods**:
- `getSpecPath()`: Returns path to spec.md file
- `getContent()`: Reads and returns file content
- `watchForChanges()`: Sets up file system watchers
- `exists()`: Checks if spec file exists

### 3. SpecParser (`specParser.ts`)

Parses spec.md files into structured data:

- **Section Parsing**: Extracts headers, subsections, and items
- **Requirements Filtering**: Identifies requirement-related sections
- **Implementation Tracking**: Handles checkbox states and progress
- **Flexible Matching**: Uses keyword-based section detection

**Key Methods**:
- `parseAllSections()`: Parses entire spec file
- `parseRequirements()`: Filters for requirement sections
- `parseImplementations()`: Extracts implementation tasks with status
- `getSectionCounts()`: Provides section statistics

### 4. Tree Data Providers (`providers.ts`)

Manages VS Code tree views with clean inheritance:

- **BaseTreeDataProvider**: Common functionality for all providers
- **SpecProvider**: General spec navigation
- **RequirementsProvider**: Requirements-focused view
- **ImplementationsProvider**: Implementation tracking with status icons
- **ActionsProvider**: Extension actions and commands

**Features**:
- Hierarchical data structure (sections → subsections → items)
- Status indicators for implementation items
- Automatic refresh on file changes
- Proper icon assignment based on item type

### 5. CommandManager (`commandManager.ts`)

Centralizes all extension command logic:

- **Command Registration**: Handles all VS Code commands
- **Process Management**: Manages uv/uvx subprocess execution
- **Interactive Input**: Handles user prompts and input collection
- **Error Handling**: Comprehensive error handling and user feedback

**Commands**:
- `startProject`: Initializes new spec project using uv/uvx
- `specifyCommand`: Sends custom specification to Copilot
- `planCommand`: Sends planning requests to Copilot
- `tasksCommand`: Executes tasks command in Copilot
- `implementCommand`: Executes implementation command in Copilot

### 6. CopilotIntegration (`copilotIntegration.ts`)

Handles GitHub Copilot Chat integration:

- **Command Fallbacks**: Multiple command attempts for reliability
- **Error Handling**: Graceful degradation when Copilot unavailable
- **User Guidance**: Helpful messages for installation and setup
- **Context Awareness**: Can include spec content in messages

**Features**:
- Tries multiple Copilot command APIs in order of preference
- Provides clear error messages and installation guidance
- Supports formatted messages with context
- Checks for Copilot availability

### 7. ExtensionActivator (`extensionActivator.ts`)

Coordinates all components and manages extension lifecycle:

- **Service Initialization**: Creates and wires up all services
- **Provider Management**: Handles tree data provider registration
- **File Watching**: Sets up comprehensive file monitoring
- **Retry Logic**: Implements robust retry mechanisms for spec file detection
- **Lifecycle Management**: Handles activation and deactivation

**Key Features**:
- Dependency injection pattern for all services
- Automatic provider refresh on file changes
- Intelligent retry mechanism when spec files aren't found
- Clean resource disposal on deactivation

## Design Principles

### 1. Single Responsibility Principle
Each class has a single, well-defined purpose:
- `SpecFileManager`: File operations only
- `SpecParser`: Parsing logic only  
- `CommandManager`: Command handling only
- `CopilotIntegration`: Copilot communication only

### 2. Dependency Injection
Components receive their dependencies through constructors, making them:
- Easier to test
- More flexible
- Loosely coupled

### 3. Interface Segregation
Interfaces are specific and focused:
- `ISpecFileManager`: File operations
- `ISpecParser`: Parsing operations
- `ICommandManager`: Command operations
- `ICopilotIntegration`: Copilot operations

### 4. Error Handling
Comprehensive error handling throughout:
- Graceful degradation when services unavailable
- Clear user feedback for error conditions
- Logging for debugging purposes
- Retry mechanisms where appropriate

### 5. Testability
The architecture supports easy testing:
- All dependencies are injected
- Interfaces allow for easy mocking
- Pure functions where possible
- Clear separation of concerns

## Data Flow

1. **Extension Activation**:
   ```
   extension.ts → ExtensionActivator → Service Creation → Provider Registration
   ```

2. **File Change Detection**:
   ```
   File System → SpecFileManager → ExtensionActivator → Provider Refresh
   ```

3. **Command Execution**:
   ```
   User Action → CommandManager → Service Interaction → User Feedback
   ```

4. **Spec Parsing**:
   ```
   File Content → SpecParser → ParsedSection[] → TreeDataProviders
   ```

## Benefits of This Architecture

### 1. Maintainability
- Clear separation of concerns makes the code easier to understand and modify
- Each component has a single responsibility
- Changes to one component don't affect others

### 2. Testability
- Dependencies are injected, making unit testing straightforward
- Each component can be tested in isolation
- Mock implementations can be easily substituted

### 3. Extensibility
- New features can be added without modifying existing code
- New providers can be easily added
- New command types can be implemented by extending CommandManager

### 4. Reliability
- Comprehensive error handling at each layer
- Retry mechanisms for transient failures
- Graceful degradation when services are unavailable

### 5. Performance
- Caching mechanisms reduce file system calls
- Efficient file watching prevents unnecessary parsing
- Lazy initialization of expensive operations

## Future Enhancements

The architecture supports easy addition of:

1. **New Providers**: Additional tree views for different spec sections
2. **New Commands**: Extended command palette functionality
3. **New Parsers**: Support for different spec file formats
4. **New Integrations**: Additional AI service integrations
5. **Caching Layer**: More sophisticated caching for large spec files
6. **Configuration**: User preferences and settings management
7. **Testing Framework**: Comprehensive test suite for all components

This architecture provides a solid foundation for the continued development and maintenance of the Specify extension.