import { Button } from '@/shared/components/Button';
import { Icon } from '@/shared/components/Icon';

type AccountMenuProps = {
    name: string;
    className?: string;
    onSignOut: () => void;
};

export function AccountMenu({ name, className = '', onSignOut }: AccountMenuProps) {
    return (
        <div className={`items-center gap-size-2 ${className}`}>
            <span className="inline-flex items-center gap-size-1 font-inter text-title-xx-small font-medium text-on-primary">
                <span
                    aria-hidden="true"
                    className="inline-flex size-icon-button-small items-center justify-center rounded-full border-button border-solid border-on-primary bg-avatar-random-3"
                >
                    <Icon filled name="person" size={20} />
                </span>
                <span className="max-w-[160px] truncate">{name}</span>
            </span>
            <Button onClick={onSignOut} size="md" variant="outline">
                Log Out
            </Button>
        </div>
    );
}
