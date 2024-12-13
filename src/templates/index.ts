import { IChecklistTemplate } from '../types';

export const templates: { [key: string]: IChecklistTemplate } = {
    typescript: {
        name: 'TypeScript Project',
        description: 'Standard checklist for TypeScript projects',
        items: [
            {
                label: 'Project Setup',
                priority: 'high',
                children: [
                    { label: 'Initialize TypeScript configuration', priority: 'high' },
                    { label: 'Setup build pipeline', priority: 'high' },
                    { label: 'Configure linting and formatting', priority: 'medium' }
                ]
            },
            {
                label: 'Core Implementation',
                priority: 'high',
                children: [
                    { label: 'Define core interfaces', priority: 'high' },
                    { label: 'Implement business logic', priority: 'high' },
                    { label: 'Add error handling', priority: 'medium' }
                ]
            },
            {
                label: 'Testing',
                priority: 'medium',
                children: [
                    { label: 'Setup testing framework', priority: 'high' },
                    { label: 'Write unit tests', priority: 'medium' },
                    { label: 'Add integration tests', priority: 'medium' }
                ]
            }
        ]
    },
    react: {
        name: 'React Application',
        description: 'Checklist for React-based applications',
        items: [
            {
                label: 'Project Structure',
                priority: 'high',
                children: [
                    { label: 'Setup component hierarchy', priority: 'high' },
                    { label: 'Configure routing', priority: 'high' },
                    { label: 'Setup state management', priority: 'high' }
                ]
            },
            {
                label: 'UI Implementation',
                priority: 'high',
                children: [
                    { label: 'Create base components', priority: 'high' },
                    { label: 'Implement responsive design', priority: 'medium' },
                    { label: 'Add animations', priority: 'low' }
                ]
            }
        ]
    }
};
