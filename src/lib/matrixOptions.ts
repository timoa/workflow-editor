/**
 * Predefined matrix variable options and their supported values
 * Based on GitHub Actions supported versions and common patterns
 */

export interface MatrixVariableOption {
  name: string
  label: string
  values: string[]
}

export const COMMON_MATRIX_VARIABLES: MatrixVariableOption[] = [
  {
    name: 'node',
    label: 'Node.js',
    values: ['16', '18', '20', '22'],
  },
  {
    name: 'python',
    label: 'Python',
    values: ['3.8', '3.9', '3.10', '3.11', '3.12', '3.13'],
  },
  {
    name: 'os',
    label: 'Operating System',
    values: [
      'ubuntu-latest',
      'ubuntu-22.04',
      'ubuntu-20.04',
      'windows-latest',
      'windows-2022',
      'windows-2019',
      'macos-latest',
      'macos-14',
      'macos-13',
      'macos-12',
    ],
  },
  {
    name: 'java',
    label: 'Java',
    values: ['8', '11', '17', '21'],
  },
  {
    name: 'go',
    label: 'Go',
    values: ['1.19', '1.20', '1.21', '1.22', '1.23'],
  },
  {
    name: 'ruby',
    label: 'Ruby',
    values: ['3.0', '3.1', '3.2', '3.3'],
  },
  {
    name: 'php',
    label: 'PHP',
    values: ['8.0', '8.1', '8.2', '8.3'],
  },
  {
    name: 'dotnet',
    label: '.NET',
    values: ['6.0', '7.0', '8.0'],
  },
]

/**
 * Get predefined values for a matrix variable name
 */
export function getMatrixVariableValues(variableName: string): string[] | null {
  const option = COMMON_MATRIX_VARIABLES.find((opt) => opt.name === variableName)
  return option ? option.values : null
}

/**
 * Check if a variable name is a predefined/common one
 */
export function isCommonMatrixVariable(variableName: string): boolean {
  return COMMON_MATRIX_VARIABLES.some((opt) => opt.name === variableName)
}
