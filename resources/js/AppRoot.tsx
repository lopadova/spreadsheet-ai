import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './api/queryClient';
import { ToastProvider } from './components/ToastProvider';
import { TabularPage } from './components/TabularPage';

export default function App() {
    const [queryClient] = useState(createQueryClient);

    return (
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <TabularPage />
            </ToastProvider>
        </QueryClientProvider>
    );
}
