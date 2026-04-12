'use client';

import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    neutralGray: { border: string; borderHover: string; hover: string };
  }
  interface PaletteOptions {
    neutralGray?: { border: string; borderHover: string; hover: string };
  }
}

export const craftTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#D0103A',
      dark: '#B80E33',
      light: '#FCE8E6',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#1F1F1F',
      light: '#3C4043',
      contrastText: '#FFFFFF',
    },
    text: {
      primary: '#1F1F1F',
      secondary: '#5F6368',
      disabled: '#80868B',
    },
    success: {
      main: '#188038',
      light: '#E6F4EA',
      contrastText: '#188038',
    },
    warning: {
      main: '#B45309',
      light: '#FEF7E0',
    },
    error: {
      main: '#C5221F',
      light: '#FCE8E6',
    },
    divider: '#E8EAED',
    action: {
      hover: 'rgba(0,0,0,0.04)',
      selected: '#F1F3F4',
      disabledBackground: 'rgba(0,0,0,0.04)',
    },
    background: {
      default: '#FFFFFF',
      paper: '#FFFFFF',
    },
    neutralGray: {
      border: '#E8EAED',
      borderHover: '#DADCE0',
      hover: '#F1F3F4',
    },
  },
  typography: {
    fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontSize: '22px', fontWeight: 600, lineHeight: 1.3 },
    h2: { fontSize: '16px', fontWeight: 600, lineHeight: 1.4 },
    h3: { fontSize: '15px', fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: '14px', fontWeight: 500, lineHeight: 1.5 },
    body2: { fontSize: '13px', fontWeight: 400, lineHeight: 1.5 },
    caption: { fontSize: '12px', lineHeight: 1.4 },
    overline: { fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 9999,
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '14px',
          lineHeight: 1.5,
          transition: 'all 0.15s ease',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        outlined: {
          borderColor: '#DADCE0',
          '&:hover': {
            borderColor: '#DADCE0',
            backgroundColor: '#F1F3F4',
          },
        },
        text: {
          '&:hover': { backgroundColor: '#F1F3F4' },
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: 'inherit',
      },
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #E8EAED',
          color: '#1F1F1F',
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: '64px !important',
          paddingLeft: '24px !important',
          paddingRight: '24px !important',
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #E8EAED',
          boxShadow: 'none',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: '#DADCE0',
            boxShadow: '0 4px 20px rgba(32,33,36,0.10)',
          },
        },
      },
    },
    MuiCardActionArea: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          '&:hover .MuiCardActionArea-focusHighlight': {
            opacity: 0,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 9999,
          height: 22,
          fontSize: '11px',
          fontWeight: 600,
        },
        colorSuccess: {
          backgroundColor: '#E6F4EA',
          color: '#188038',
        },
        colorWarning: {
          backgroundColor: '#FEF7E0',
          color: '#B45309',
        },
        colorError: {
          backgroundColor: '#FCE8E6',
          color: '#C5221F',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          borderBottom: '2px solid #E8EAED',
          marginBottom: 0,
        },
        indicator: {
          backgroundColor: '#D0103A',
          borderRadius: '3px 3px 0 0',
          height: 3,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontSize: '15px',
          fontWeight: 500,
          color: '#80868B',
          paddingLeft: 0,
          paddingRight: 24,
          paddingBottom: 14,
          minWidth: 0,
          '&.Mui-selected': {
            color: '#1F1F1F',
            fontWeight: 600,
          },
          '&:hover': {
            color: '#3C4043',
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontSize: '12px',
          fontWeight: 500,
          paddingTop: 4,
          paddingBottom: 4,
          paddingLeft: 12,
          paddingRight: 12,
          border: 'none !important',
          color: '#80868B',
          borderRadius: '9999px !important',
          transition: 'all 0.15s ease',
          '&.Mui-selected': {
            backgroundColor: '#1F1F1F',
            color: '#FFFFFF',
            '&:hover': {
              backgroundColor: '#3C4043',
            },
          },
          '&:hover': {
            backgroundColor: '#F1F3F4',
            color: '#3C4043',
          },
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8EAED',
          borderRadius: 9999,
          padding: 2,
          gap: 0,
        },
        grouped: {
          border: 'none !important',
          borderRadius: '9999px !important',
          '&:not(:first-of-type)': {
            marginLeft: 0,
            borderLeft: 'none !important',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontSize: '14px',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#DADCE0',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#D0103A',
            borderWidth: 1.5,
            boxShadow: '0 0 0 3px rgba(208,16,58,0.08)',
          },
        },
        notchedOutline: {
          borderColor: '#DADCE0',
        },
        input: {
          '&::placeholder': {
            color: '#BDC1C6',
            opacity: 1,
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: {
        variant: 'standard',
      },
      styleOverrides: {
        standard: {
          fontSize: '13px',
          fontWeight: 500,
          color: '#3C4043',
          paddingRight: '24px !important',
          '&:focus': { backgroundColor: 'transparent' },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '13px',
          paddingTop: 10,
          paddingBottom: 10,
          '&.Mui-selected': {
            backgroundColor: '#F1F3F4',
            fontWeight: 600,
            color: '#1F1F1F',
          },
          '&:hover': {
            backgroundColor: '#F1F3F4',
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: '#F1F3F4',
        },
        bar: {
          backgroundColor: '#D0103A',
          borderRadius: 4,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        },
      },
    },
    MuiCircularProgress: {
      defaultProps: { color: 'primary' },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontSize: '12px',
          fontWeight: 600,
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 9999,
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: '#F1F3F4',
          },
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: '1px solid #E8EAED',
          boxShadow: '0 4px 20px rgba(32,33,36,0.12)',
        },
      },
    },
  },
});
