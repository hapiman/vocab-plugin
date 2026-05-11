import UIKit

final class EmptyStateView: UIView {
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

    func configure(title: String, message: String) {
        titleLabel.text = title
        messageLabel.text = message
    }

    private func setup() {
        titleLabel.font = .systemFont(ofSize: 20, weight: .semibold)
        titleLabel.textColor = .label
        titleLabel.textAlignment = .center

        messageLabel.font = .systemFont(ofSize: 15)
        messageLabel.textColor = .secondaryLabel
        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [titleLabel, messageLabel])
        stack.axis = .vertical
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
    }
}
