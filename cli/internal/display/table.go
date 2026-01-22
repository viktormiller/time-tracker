package display

import (
	"fmt"
	"strings"
)

// Table represents an ASCII table
type Table struct {
	Headers []string
	Rows    [][]string
}

// NewTable creates a new table with headers
func NewTable(headers ...string) *Table {
	return &Table{
		Headers: headers,
		Rows:    [][]string{},
	}
}

// AddRow adds a row to the table
func (t *Table) AddRow(cells ...string) {
	t.Rows = append(t.Rows, cells)
}

// Render renders the table as a string
func (t *Table) Render() string {
	if len(t.Headers) == 0 {
		return ""
	}

	// Calculate column widths
	colWidths := make([]int, len(t.Headers))
	for i, header := range t.Headers {
		colWidths[i] = len(header)
	}

	for _, row := range t.Rows {
		for i, cell := range row {
			if i < len(colWidths) && len(cell) > colWidths[i] {
				colWidths[i] = len(cell)
			}
		}
	}

	var sb strings.Builder

	// Draw top border
	sb.WriteString("┌")
	for i, width := range colWidths {
		sb.WriteString(strings.Repeat("─", width+2))
		if i < len(colWidths)-1 {
			sb.WriteString("┬")
		}
	}
	sb.WriteString("┐\n")

	// Draw headers
	sb.WriteString("│")
	for i, header := range t.Headers {
		sb.WriteString(" ")
		sb.WriteString(header)
		sb.WriteString(strings.Repeat(" ", colWidths[i]-len(header)))
		sb.WriteString(" │")
	}
	sb.WriteString("\n")

	// Draw header separator
	sb.WriteString("├")
	for i, width := range colWidths {
		sb.WriteString(strings.Repeat("─", width+2))
		if i < len(colWidths)-1 {
			sb.WriteString("┼")
		}
	}
	sb.WriteString("┤\n")

	// Draw rows
	for _, row := range t.Rows {
		sb.WriteString("│")
		for i, cell := range row {
			if i >= len(colWidths) {
				break
			}
			sb.WriteString(" ")
			sb.WriteString(cell)
			sb.WriteString(strings.Repeat(" ", colWidths[i]-len(cell)))
			sb.WriteString(" │")
		}
		sb.WriteString("\n")
	}

	// Draw bottom border
	sb.WriteString("└")
	for i, width := range colWidths {
		sb.WriteString(strings.Repeat("─", width+2))
		if i < len(colWidths)-1 {
			sb.WriteString("┴")
		}
	}
	sb.WriteString("┘\n")

	return sb.String()
}

// Print prints the table to stdout
func (t *Table) Print() {
	fmt.Print(t.Render())
}
