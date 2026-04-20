export const Footer = () => {
  return (
    <footer className="border-t border-border mt-8">
      <div className="mx-auto max-w-6xl px-4 py-3 font-mono text-xs text-muted-foreground text-center">
        Created by{' '}
        <a href="https://inodes.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
          John Ferlito
        </a>{' '}
        in a project funded by the{' '}
        <a href="https://ldaca.edu.au" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
          Language Data Commons of Australia
        </a>{' '}
        &mdash;{' '}
        <a
          href="https://github.com/paradisec-archive/cockatiel"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground transition-colors"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
};
