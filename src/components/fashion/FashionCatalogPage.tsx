import CatalogWorkspace from '../catalog/shared/CatalogWorkspace';
import { CATALOG_CONFIGS } from '../catalog/shared/catalogConfig';

export default function FashionCatalogPage() {
  return <CatalogWorkspace config={CATALOG_CONFIGS.fashion} />;
}
