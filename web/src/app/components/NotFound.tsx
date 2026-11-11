import { Link } from '@tanstack/react-router';

export function NotFound() {
    return (
        <section className="mx-auto flex w-full flex-col items-center gap-size-2 px-size-4 py-size-8 text-center">
            <p className="text-label-large font-bold uppercase text-on-bg-low">404</p>
            <h1 className="text-headline-large font-bold text-on-primary">Page not found</h1>
            <p className="text-body-medium">The page you are looking for does not exist.</p>
            <Link
                className="rounded-small border-button border-black bg-primary px-button-medium-x py-button-medium-y font-bold text-on-primary hover:bg-primary-high focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring"
                to="/"
            >
                Return home
            </Link>
        </section>
    );
}
