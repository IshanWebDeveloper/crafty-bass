'use client';

import { SunIcon, MoonIcon, SunMoonIcon, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon">
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const ThemeModeButton = () => {
  const { setTheme, resolvedTheme } = useTheme();
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const currentMode = isHydrated ? (resolvedTheme ?? 'system') : 'system';

  let iconElement = <SunMoonIcon className="h-4 w-4" />;
  if (currentMode === 'light') {
    iconElement = <SunIcon className="h-4 w-4" />;
  } else if (currentMode === 'dark') {
    iconElement = <MoonIcon className="h-4 w-4" />;
  }

  const handleModeChange = () => {
    if (currentMode === 'light') {
      setTheme('dark');
    } else if (currentMode === 'dark') {
      setTheme('light');
    } else {
      setTheme('system');
    }
  };

  return (
    <div>
      <Button
        variant="outline"
        size="default"
        onClick={() => handleModeChange()}
        aria-label="Toggle dark mode"
        className="text-nowrap dark:hover:bg-white/10 dark:border-slate-50 dark:focus-visible:border-sky-400 dark:focus-visible:ring-sky-400/10 border-white-50 text-white-600! hover:bg-gray-600/10  hover:text-white hover:text-shadow-white/30 focus-visible:border-white-600 focus-visible:ring-white-600 p-1 rounded-l-sm m-1 w-fit bg-black-700"
      >
        <div className="flex gap-2 items-center px-1">
          {iconElement}
          {currentMode.charAt(0).toUpperCase() +
            currentMode.slice(1).padEnd(10)}
        </div>
      </Button>
    </div>
  );
};

export { ThemeModeButton };
