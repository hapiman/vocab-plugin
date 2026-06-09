import UIKit

final class EmptyStateView: UIView {
    private let iconView = UIImageView()
    private let titleLabel = UILabel()
    private let messageLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    func configure(title: String, message: String, icon: String = "tray") {
        titleLabel.text = title
        messageLabel.text = message
        iconView.image = UIImage(systemName: icon)
    }

    private func setup() {
        iconView.image = UIImage(systemName: "tray")
        iconView.tintColor = Theme.Colors.subtleText.withAlphaComponent(0.4)
        iconView.contentMode = .scaleAspectFit
        iconView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 44, weight: .light)

        titleLabel.font = Theme.Font.title
        titleLabel.textColor = .label
        titleLabel.textAlignment = .center

        messageLabel.font = Theme.Font.body
        messageLabel.textColor = Theme.Colors.subtleText
        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [iconView, titleLabel, messageLabel])
        stack.axis = .vertical
        stack.spacing = Theme.Spacing.md
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: Theme.Spacing.xxxl),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -Theme.Spacing.xxxl),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -20)
        ])
    }
}
