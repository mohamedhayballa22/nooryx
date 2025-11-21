import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Your App Name',
      // You can add more navigation options here
    },
    links: [
      // Optional: Add links to navbar
      // {
      //   text: 'Home',
      //   url: '/',
      // },
    ],
  };
}
