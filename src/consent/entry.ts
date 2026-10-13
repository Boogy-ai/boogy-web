// The script the platform's consent pages load (install and upgrade). Nothing
// else runs there: each page carries one root, and only that page's UI boots.
import { installFoundation } from '../layout/install';
import { bootInstallConsent } from './install';
import { bootUpgradeConsent, UPGRADE_ROOT_ID } from './upgrade';

installFoundation();
if (document.getElementById(UPGRADE_ROOT_ID)) bootUpgradeConsent();
else bootInstallConsent();
