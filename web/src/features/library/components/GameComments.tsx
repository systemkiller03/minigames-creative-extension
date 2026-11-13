import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { ApiError } from '@/shared/api/client';
import {
    COMMENT_MAX_LENGTH,
    getComments,
    postComment,
    toggleCommentLike,
    type Comment,
    type CommentsList,
} from '@/shared/api/comments.api';
import { getButtonClassName } from '@/shared/components/Button';
import { ErrorState } from '@/shared/components/ErrorState';
import { Icon } from '@/shared/components/Icon';
import { LoadingState } from '@/shared/components/LoadingState';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import { formatCount, formatRelativeTime } from '@/shared/utils/format';

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof ApiError && error.status !== 401 && error.status < 500
        ? error.message
        : fallback;
}

function CommentItem({ comment, queryKey }: { comment: Comment; queryKey: readonly unknown[] }) {
    const queryClient = useQueryClient();
    const snackbar = useSnackbar();
    const navigate = useNavigate();
    const { status } = useAuth();

    const like = useMutation({
        mutationFn: () => toggleCommentLike(comment.commentId),
        onSuccess: (state) => {
            queryClient.setQueryData<CommentsList>(queryKey, (cached) =>
                cached
                    ? {
                          ...cached,
                          comments: cached.comments.map((item) =>
                              item.commentId === comment.commentId ? { ...item, ...state } : item,
                          ),
                      }
                    : cached,
            );
        },
        onError: (error) => snackbar.error(errorMessage(error, 'Could not update your like.')),
    });

    const onLike = (): void => {
        if (status !== 'authenticated') {
            snackbar.info('Log in to like comments.');
            void navigate({
                to: '.',
                search: (previous) => ({ ...previous, auth: 'login' }),
            });
            return;
        }
        like.mutate();
    };

    return (
        <li className="flex flex-col gap-size-1 rounded-small bg-white p-size-2">
            <div className="flex items-center justify-between gap-size-1">
                <span className="truncate text-label-large font-bold text-on-primary">
                    {comment.authorName}
                </span>
                <span className="shrink-0 text-label-medium font-normal text-on-bg">
                    {formatRelativeTime(comment.createdAt)}
                </span>
            </div>
            <p className="whitespace-pre-wrap break-words text-body-medium font-normal leading-[20px] text-on-primary">
                {comment.text}
            </p>
            <button
                aria-label={comment.isLikedByCurrentUser ? 'Unlike comment' : 'Like comment'}
                aria-pressed={comment.isLikedByCurrentUser}
                className="inline-flex cursor-pointer items-center gap-size-05 self-start rounded-small text-label-medium font-bold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring disabled:cursor-wait"
                disabled={like.isPending}
                onClick={onLike}
                type="button"
            >
                <Icon
                    className="text-[18px] text-like"
                    filled={comment.isLikedByCurrentUser}
                    name="favorite"
                />
                {formatCount(comment.likesCount)}
            </button>
        </li>
    );
}

function CommentForm({ slug, queryKey }: { slug: string; queryKey: readonly unknown[] }) {
    const queryClient = useQueryClient();
    const snackbar = useSnackbar();
    const { status } = useAuth();
    const [text, setText] = useState('');
    const [invalid, setInvalid] = useState(false);

    const post = useMutation({
        mutationFn: (value: string) => postComment(slug, value),
        onSuccess: (created) => {
            setText('');
            queryClient.setQueryData<CommentsList>(queryKey, (cached) =>
                cached
                    ? { comments: [created, ...cached.comments], total: cached.total + 1 }
                    : cached,
            );
            snackbar.success('Comment posted.');
        },
        onError: (error) =>
            snackbar.error(errorMessage(error, 'Could not post your comment. Please try again.')),
    });

    if (status !== 'authenticated') {
        return (
            <p className="flex flex-wrap items-center gap-size-1 rounded-small bg-white p-size-2 text-body-medium text-on-bg">
                <span>Log in to join the conversation.</span>
                <Link
                    className={getButtonClassName('outline', 'sm')}
                    search={(previous) => ({ ...previous, auth: 'login' })}
                    to="."
                >
                    Log In
                </Link>
            </p>
        );
    }

    const onSubmit = (event: FormEvent): void => {
        event.preventDefault();
        const value = text.trim();
        if (!value) {
            setInvalid(true);
            return;
        }
        setInvalid(false);
        post.mutate(value);
    };

    return (
        <form className="flex flex-col gap-size-1" noValidate onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="comment-text">
                Write a comment
            </label>
            <textarea
                aria-describedby={invalid ? 'comment-error' : undefined}
                aria-invalid={invalid}
                className="min-h-[80px] w-full resize-y rounded-small border border-solid border-outline-variant bg-white p-size-2 text-body-medium text-on-primary focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring"
                id="comment-text"
                maxLength={COMMENT_MAX_LENGTH}
                onChange={(event) => setText(event.target.value)}
                placeholder="Share your thoughts about this game..."
                value={text}
            />
            <div className="flex items-center justify-between gap-size-2">
                <span className="text-label-medium text-on-bg">
                    {invalid ? (
                        <span id="comment-error" role="alert" className="text-error">
                            Write something first.
                        </span>
                    ) : (
                        `${text.length}/${COMMENT_MAX_LENGTH}`
                    )}
                </span>
                <button
                    className={getButtonClassName('primary', 'md')}
                    disabled={post.isPending}
                    type="submit"
                >
                    {post.isPending ? 'Posting...' : 'Post comment'}
                </button>
            </div>
        </form>
    );
}

export function GameComments({ slug }: { slug: string }) {
    const { status } = useAuth();
    const queryKey = ['comments', slug, status === 'authenticated'] as const;
    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) => getComments(slug, signal),
        enabled: status !== 'loading',
    });

    return (
        <section aria-labelledby="game-comments-title" className="flex flex-col gap-size-2">
            <h3
                className="flex items-center gap-size-1 text-body-medium font-bold leading-normal text-on-primary"
                id="game-comments-title"
            >
                <span aria-hidden="true" className="text-[18px] font-normal">
                    💬
                </span>
                Comments{query.data ? ` (${query.data.total})` : ''}
            </h3>
            <CommentForm queryKey={queryKey} slug={slug} />
            {query.isPending ? (
                <LoadingState label="Loading comments..." />
            ) : query.isError ? (
                <ErrorState
                    message="We couldn’t load the comments. Please try again."
                    onRetry={() => void query.refetch()}
                />
            ) : query.data.comments.length === 0 ? (
                <p className="text-body-medium text-on-bg">No comments yet. Be the first!</p>
            ) : (
                <ul className="flex max-h-[320px] list-none flex-col gap-size-1 overflow-y-auto">
                    {query.data.comments.map((comment) => (
                        <CommentItem
                            comment={comment}
                            key={comment.commentId}
                            queryKey={queryKey}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}
