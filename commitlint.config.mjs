export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'scope-enum': [2, 'always', ['api', 'web', 'frontend', 'infra', 'ci', 'deps', 'docs']],
    },
};