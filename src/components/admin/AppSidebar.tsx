import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from 'antd';
import SidebarItem from './SidebarItem';
import HomeIcon from './icons/HomeIcon';
import EventsIcon from './icons/EventsIcon';
import BannersIcon from './icons/BannersIcon';

const { Sider } = Layout;

interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: MenuItem[];
}

interface AppSidebarProps {
  collapsed: boolean;
  menuItems: MenuItem[];
  onItemClick?: () => void;
}

export default function AppSidebar({ collapsed, menuItems, onItemClick }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  // Determine active key based on current location
  const activeKey = useMemo(() => {
    const pathname = location.pathname;

    // Sort menu items by path length (longest first) for better matching
    const sortedItems = [...menuItems].sort((a, b) => {
      const aLen = a.path?.length || 0;
      const bLen = b.path?.length || 0;
      return bLen - aLen;
    });

    // Try exact match first
    for (const item of sortedItems) {
      if (item.path === pathname) {
        return item.key;
      }
    }

    // Try prefix match for routes with parameters
    for (const item of sortedItems) {
      if (item.path && pathname.startsWith(item.path) && pathname.length > item.path.length) {
        return item.key;
      }
    }

    return '';
  }, [location.pathname, menuItems]);

  const handleMenuClick = ({ key }: { key: string }) => {
    const findMenuItem = (items: MenuItem[], targetKey: string): MenuItem | null => {
      for (const item of items) {
        if (item.key === targetKey) return item;
        if (item.children) {
          const found = findMenuItem(item.children, targetKey);
          if (found) return found;
        }
      }
      return null;
    };

    const item = findMenuItem(menuItems, key);

    if (item?.children) {
      // Toggle submenu
      setOpenKeys((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      );
    } else if (item?.path) {
      // Navigate to path
      navigate(item.path);
      // Notify parent (for mobile menu close)
      onItemClick?.();
    }
  };

  const renderMenuItems = (items: MenuItem[], isSubmenu = false): React.ReactNode => {
    return items.map((item) => {
      const hasChildren = item.children && item.children.length > 0;
      const isActive = activeKey === item.key;
      const isOpen = openKeys.includes(item.key);

      return (
        <div key={item.key}>
          <SidebarItem
            label={item.label}
            icon={item.icon}
            active={isActive}
            collapsed={collapsed}
            onClick={() => handleMenuClick({ key: item.key })}
            hasChildren={hasChildren}
            isOpen={isOpen}
            isSubmenu={isSubmenu}
          />

          {/* Render submenu children */}
          {hasChildren && !collapsed && isOpen && item.children && (
            <div className="ml-4 mt-1 space-y-1">
              {renderMenuItems(item.children, true)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      width={256}
      trigger={null}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        background: '#fff',
        borderRight: '1px solid #f0f0f0',
      }}
      className="transition-all duration-300"
    >
      {/* Logo/Header */}
      <div className="p-4 border-b border-gray-200">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <img
            src="/Assets/logo.png"
            alt="Lumpat Logo"
            className={`flex-shrink-0 object-contain ${collapsed ? 'w-10 h-10' : 'w-10 h-10'}`}
          />
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-gray-900">Lumpat</h1>
              <p className="text-xs text-gray-500">Admin Panel</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="p-4 space-y-1">
        {renderMenuItems(menuItems)}
      </div>
    </Sider>
  );
}

// Export default menu items for use in AdminLayout
export const defaultMenuItems: MenuItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: <HomeIcon />,
    path: '/admin/overview',
  },
  {
    key: 'events',
    label: 'Events',
    icon: <EventsIcon />,
    path: '/admin/events',
  },
  {
    key: 'banners',
    label: 'Banners',
    icon: <BannersIcon />,
    path: '/admin/banners',
  },
];
