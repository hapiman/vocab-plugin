import UIKit

final class RootTabBarController: UITabBarController, UITabBarControllerDelegate {
    override func viewDidLoad() {
        super.viewDidLoad()
        delegate = self
        configureAppearance()

        viewControllers = [
            makeNavigationController(
                root: HomeViewController(),
                title: "复习",
                icon: "rectangle.stack.fill",
                inactiveIcon: "rectangle.stack"
            ),
            makeNavigationController(
                root: VocabularyViewController(),
                title: "词库",
                icon: "book.fill",
                inactiveIcon: "book"
            ),
            makeNavigationController(
                root: SettingsViewController(),
                title: "设置",
                icon: "gearshape.fill",
                inactiveIcon: "gearshape"
            )
        ]
    }

    private func configureAppearance() {
        let tabBarAppearance = UITabBarAppearance()
        tabBarAppearance.configureWithDefaultBackground()
        tabBarAppearance.backgroundColor = Theme.Colors.cardBackground
        tabBar.standardAppearance = tabBarAppearance
        tabBar.scrollEdgeAppearance = tabBarAppearance
        tabBar.tintColor = Theme.Colors.accent

        let navBarAppearance = UINavigationBarAppearance()
        navBarAppearance.configureWithDefaultBackground()
        navBarAppearance.backgroundColor = Theme.Colors.pageBackground
        navBarAppearance.shadowColor = .clear
        navBarAppearance.titleTextAttributes = [.font: Theme.Font.headline]
        navBarAppearance.largeTitleTextAttributes = [.font: Theme.Font.largeTitle]

        UINavigationBar.appearance().standardAppearance = navBarAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navBarAppearance
        UINavigationBar.appearance().tintColor = Theme.Colors.accent
    }

    // MARK: - UITabBarControllerDelegate

    func tabBarController(_ tabBarController: UITabBarController, shouldSelect viewController: UIViewController) -> Bool {
        // If tapping the already-selected tab, scroll its table view to top
        if viewController == selectedViewController,
           let nav = viewController as? UINavigationController,
           let top = nav.topViewController as? UITableViewController {
            top.tableView.scrollToRow(at: IndexPath(row: 0, section: 0), at: .top, animated: true)
        }
        return true
    }

    private func makeNavigationController(root: UIViewController, title: String, icon: String, inactiveIcon: String) -> UIViewController {
        root.title = title
        let navigationController = UINavigationController(rootViewController: root)
        navigationController.tabBarItem = UITabBarItem(
            title: title,
            image: UIImage(systemName: inactiveIcon),
            selectedImage: UIImage(systemName: icon)
        )
        return navigationController
    }
}
