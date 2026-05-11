import UIKit

enum StatCardType {
    case due
    case learning
    case mastered
}

final class StatSummaryView: UIView {
    private let stackView = UIStackView()
    private let dueCard = StatCardView(
        icon: "flame.fill",
        label: "今日到期",
        color: Theme.Colors.statDue
    )
    private let learningCard = StatCardView(
        icon: "book.fill",
        label: "学习中",
        color: Theme.Colors.statLearning
    )
    private let masteredCard = StatCardView(
        icon: "checkmark.seal.fill",
        label: "已掌握",
        color: Theme.Colors.statMastered
    )

    var onTap: ((StatCardType) -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    func configure(due: Int, learning: Int, mastered: Int) {
        dueCard.setValue(due)
        learningCard.setValue(learning)
        masteredCard.setValue(mastered)
    }

    private func setup() {
        stackView.axis = .horizontal
        stackView.distribution = .fillEqually
        stackView.spacing = Theme.Spacing.md
        stackView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stackView)

        stackView.addArrangedSubview(dueCard)
        stackView.addArrangedSubview(learningCard)
        stackView.addArrangedSubview(masteredCard)

        dueCard.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(dueTapped)))
        learningCard.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(learningTapped)))
        masteredCard.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(masteredTapped)))

        NSLayoutConstraint.activate([
            stackView.topAnchor.constraint(equalTo: topAnchor),
            stackView.leadingAnchor.constraint(equalTo: leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: trailingAnchor),
            stackView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    @objc private func dueTapped() {
        animateCard(dueCard)
        onTap?(.due)
    }

    @objc private func learningTapped() {
        animateCard(learningCard)
        onTap?(.learning)
    }

    @objc private func masteredTapped() {
        animateCard(masteredCard)
        onTap?(.mastered)
    }

    private func animateCard(_ card: UIView) {
        UIView.animate(withDuration: 0.1, delay: 0, options: .curveEaseIn) {
            card.transform = CGAffineTransform(scaleX: 0.95, y: 0.95)
        } completion: { _ in
            UIView.animate(withDuration: 0.1, delay: 0, options: .curveEaseOut) {
                card.transform = .identity
            }
        }
    }
}

// MARK: - Individual Stat Card

private final class StatCardView: UIView {
    private let valueLabel = UILabel()
    private let iconView = UIImageView()
    private let titleLabel = UILabel()
    private let accentColor: UIColor

    init(icon: String, label: String, color: UIColor) {
        self.accentColor = color
        super.init(frame: .zero)

        isUserInteractionEnabled = true
        backgroundColor = Theme.Colors.cardBackground
        layer.cornerRadius = Theme.Radius.medium
        Theme.applyCardShadow(to: layer)

        iconView.image = UIImage(systemName: icon)
        iconView.tintColor = color
        iconView.contentMode = .scaleAspectFit

        valueLabel.font = Theme.Font.statValue
        valueLabel.textColor = .label
        valueLabel.text = "0"

        titleLabel.text = label
        titleLabel.font = Theme.Font.statLabel
        titleLabel.textColor = Theme.Colors.subtleText

        let topRow = UIStackView(arrangedSubviews: [iconView, valueLabel])
        topRow.axis = .horizontal
        topRow.spacing = Theme.Spacing.sm
        topRow.alignment = .center

        iconView.translatesAutoresizingMaskIntoConstraints = false
        iconView.widthAnchor.constraint(equalToConstant: 20).isActive = true
        iconView.heightAnchor.constraint(equalToConstant: 20).isActive = true

        let stack = UIStackView(arrangedSubviews: [topRow, titleLabel])
        stack.axis = .vertical
        stack.spacing = Theme.Spacing.xs
        stack.isUserInteractionEnabled = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: Theme.Spacing.lg),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: Theme.Spacing.md),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -Theme.Spacing.md),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -Theme.Spacing.lg)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func setValue(_ value: Int) {
        valueLabel.text = "\(value)"
    }
}
