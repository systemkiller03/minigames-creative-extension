import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library')({
    component: LibraryRoute,
});

function LibraryRoute() {
    return (
        <section className="px-size-4 py-size-8">
            <h1 className="text-headline-large font-bold text-on-primary">Game Library</h1>
            <p className="mt-size-2 text-body-medium">
                Library content is coming in a later milestone.
            </p>
        </section>
    );
}
