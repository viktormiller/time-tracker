# Makefile for TimeTracker CLI

.PHONY: build clean install test run

# Build the CLI binary
build:
	@echo "Building timetracker CLI..."
	@go build -o timetracker .
	@echo "✓ Build complete: ./timetracker"

# Build for multiple platforms
build-all:
	@echo "Building for multiple platforms..."
	@GOOS=darwin GOARCH=amd64 go build -o timetracker-darwin-amd64 .
	@GOOS=darwin GOARCH=arm64 go build -o timetracker-darwin-arm64 .
	@GOOS=linux GOARCH=amd64 go build -o timetracker-linux-amd64 .
	@GOOS=windows GOARCH=amd64 go build -o timetracker-windows-amd64.exe .
	@echo "✓ Cross-compilation complete"

# Install the binary to $GOPATH/bin
install:
	@echo "Installing timetracker CLI..."
	@go install .
	@echo "✓ Installed to $(shell go env GOPATH)/bin/timetracker"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -f timetracker timetracker-*
	@echo "✓ Clean complete"

# Run tests
test:
	@echo "Running tests..."
	@go test -v ./...

# Run the CLI (for development)
run:
	@go run . $(ARGS)

# Download dependencies
deps:
	@echo "Downloading dependencies..."
	@go mod download
	@go mod tidy
	@echo "✓ Dependencies ready"

# Show help
help:
	@echo "TimeTracker CLI Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  build      - Build the CLI binary"
	@echo "  build-all  - Build for multiple platforms"
	@echo "  install    - Install to GOPATH/bin"
	@echo "  clean      - Remove build artifacts"
	@echo "  test       - Run tests"
	@echo "  run        - Run the CLI (use ARGS='...' for arguments)"
	@echo "  deps       - Download and tidy dependencies"
	@echo "  help       - Show this help message"
